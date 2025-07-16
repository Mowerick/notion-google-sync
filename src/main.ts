import { Client } from '@notionhq/client';
import { QueryDatabaseParameters } from '@notionhq/client/build/src/api-endpoints';
import fs from 'fs';
import { JWT } from 'google-auth-library'; // OAuth2Client for authentication
import nodemailer from 'nodemailer';
import path from 'path';

import config from 'config';
import sequelize, {
  destroyEndedEvents,
  getEvent,
  saveEventsToDatabase,
} from 'database';
import {
  createCalendarEvent,
  deleteEventsForDeletedNotionPages,
  fetchGoogleCalendarEvents,
  updateCalendarEvent,
} from 'google';
import logger from 'logger';
import { archiveOldTasks, fetchNotionPage } from 'notion';
import convertNotionTaskToCalendarEvent from 'utils';

const GOOGLE_AUTH = new JWT({
  email: config.google.api.serviceAccountKey?.client_email,
  key: config.google.api.serviceAccountKey?.private_key,
  scopes: ['https://www.googleapis.com/auth/calendar'],
});

const NOTION_CLIENT = new Client({ auth: config.notion.api.token });

const GOOGLE_CALENDAR_ID = config.google.calendarId;

const NOTION_PAGE_ID = config.notion.pageId;

const MAIL_SERVICE = nodemailer.createTransport({
  service: config.mailer.service,
  auth: {
    user: config.mailer.auth.user,
    pass: config.mailer.auth.password,
  },
});

const MAIL_OPTIONS = {
  from: `"Notion-google-sync" <${config.mailer.from}>`,
  to: config.mailer.to,
  subject: config.mailer.subject,
  text: `Please find the attached log from ${new Date().toDateString()}`,
};

async function main() {
  await sequelize.sync();
  const databaseParam: QueryDatabaseParameters = {
    filter: {
      property: 'Status',
      status: {
        does_not_equal: 'Archived',
      },
    },
    database_id: NOTION_PAGE_ID,
  };

  const dbPath = path.resolve(config.sqlite.path);
  if (fs.existsSync(dbPath)) {
    const calendarEvents = await fetchGoogleCalendarEvents(
      GOOGLE_AUTH,
      GOOGLE_CALENDAR_ID
    );
    if (calendarEvents) await saveEventsToDatabase(calendarEvents);
  } else {
    logger.error(
      `Database not found at ${dbPath} so script execution stopped.`
    );
    return;
  }

  await destroyEndedEvents();

  const pages = await fetchNotionPage(NOTION_CLIENT, databaseParam);

  await archiveOldTasks(pages, NOTION_CLIENT);

  await deleteEventsForDeletedNotionPages(
    pages,
    GOOGLE_AUTH,
    GOOGLE_CALENDAR_ID
  );

  for (const page of pages || []) {
    if (!page.dateStart) {
      logger.error(`Page: ${page.task} got no Date, event will not be created`);
      continue;
    }

    const event = convertNotionTaskToCalendarEvent(page);

    const existingEvent = await getEvent(page.id);
    if (existingEvent) {
      await updateCalendarEvent(
        GOOGLE_AUTH,
        GOOGLE_CALENDAR_ID,
        event,
        existingEvent
      );
    } else {
      await createCalendarEvent(GOOGLE_AUTH, GOOGLE_CALENDAR_ID, event);
    }
  }

  const filename = config.logger.filename;
  const filepath = config.logger.path;
  const logFilePath =
    (filepath.endsWith('/') ? filepath : filepath + '/') +
    (filename.startsWith('/') ? filename.substring(1) : filename);
  const content = fs.readFileSync(logFilePath, 'utf-8');
  MAIL_SERVICE.sendMail({
    ...MAIL_OPTIONS,
    attachments: [
      {
        filename: config.logger.filename,
        content,
      },
    ],
  });
}

main();
