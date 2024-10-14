import { Client } from '@notionhq/client';
import { QueryDatabaseParameters } from '@notionhq/client/build/src/api-endpoints';
import fs from 'fs';
import { JWT } from 'google-auth-library'; // OAuth2Client for authentication
import nodemailer from 'nodemailer';

import config from 'config';
import sequelize, {
  destroyOldEvents,
  getEvent,
  saveEventsToDatabase,
} from 'database';
import {
  createCalendarEvent,
  fetchGoogleCalendarEvents,
  updateCalendarEvent,
} from 'google';
import logger from 'logger';
import fetchNotionPage, { archiveOldTasks } from 'notion';
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
  const deletedRowsCount = await destroyOldEvents();
  logger.info('Deleted ' + deletedRowsCount + ' Rows');
  const databaseParam: QueryDatabaseParameters = {
    filter: {
      property: 'Status',
      status: {
        does_not_equal: 'Archived',
      },
    },
    database_id: NOTION_PAGE_ID,
  };

  const calendarEvents = await fetchGoogleCalendarEvents(
    GOOGLE_AUTH,
    GOOGLE_CALENDAR_ID
  );

  if (calendarEvents) await saveEventsToDatabase(calendarEvents);

  const pages = await fetchNotionPage(NOTION_CLIENT, databaseParam);
  await archiveOldTasks(pages, NOTION_CLIENT);
  for (const page of pages || []) {
    if (!page.dateStart) {
      logger.error(`Page: ${page.task} got no Date, creation cancelled`);
      continue; // Use continue instead of return to proceed to the next iteration
    }
    const event = convertNotionTaskToCalendarEvent(page);

    const existingEvent = await getEvent(page.id);
    if (existingEvent) {
      await updateCalendarEvent(
        GOOGLE_AUTH,
        GOOGLE_CALENDAR_ID,
        page.priority,
        event,
        existingEvent
      );
    } else {
      await createCalendarEvent(
        GOOGLE_AUTH,
        GOOGLE_CALENDAR_ID,
        page.priority,
        event
      );
    }
  }

  const filename = config.logger.filename;
  const path = config.logger.path;
  const logFilePath =
    (path.endsWith('/') ? path : path + '/') +
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
