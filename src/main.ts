import { Client } from '@notionhq/client';
import { QueryDatabaseParameters } from '@notionhq/client/build/src/api-endpoints';
import fs from 'fs';
import { JWT } from 'google-auth-library'; // OAuth2Client for authentication
import nodemailer from 'nodemailer';

import config from 'config';
import {
  createCalendarEvent,
  deleteOrphanedGoogleEvents,
  fetchRelevantGoogleCalendarEvents,
  updateCalendarEvent,
} from 'google';
import logger from 'logger';
import { archiveOldTasks, fetchNotionPages } from 'notion';
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
  const notionDatabaseParams: QueryDatabaseParameters = {
    filter: {
      property: 'Status',
      status: {
        does_not_equal: 'Archived',
      },
    },
    database_id: NOTION_PAGE_ID,
  };

  const pages = await fetchNotionPages(NOTION_CLIENT, notionDatabaseParams);
  const logMsg =
    pages.length === 1
      ? 'Process 1 notion task'
      : `Processing all ${pages.length} notion tasks`;
  logger.info(logMsg);
  const pagesWithoutArchived = await archiveOldTasks(pages, NOTION_CLIENT);

  const existingCalendarEvents = await fetchRelevantGoogleCalendarEvents(
    GOOGLE_AUTH,
    GOOGLE_CALENDAR_ID
  );

  const existingEventMap = new Map(
    existingCalendarEvents.map((event) => [event.id, event])
  );

  for (const page of pagesWithoutArchived || []) {
    if (!page.dateStart) {
      logger.info(
        `Page: ${page.task} Category: ${page.category} got no Date, event will not be created`
      );
      continue;
    }

    const event = convertNotionTaskToCalendarEvent(page);
    await new Promise((res) => setTimeout(res, 10));
    if (existingEventMap.has(page.id)) {
      await updateCalendarEvent(
        GOOGLE_AUTH,
        GOOGLE_CALENDAR_ID,
        event,
        existingEventMap.get(page.id)!
      );
    } else {
      await createCalendarEvent(GOOGLE_AUTH, GOOGLE_CALENDAR_ID, event);
    }
  }

  const archivedNotionParams: QueryDatabaseParameters = {
    filter: {
      property: 'Status',
      status: { equals: 'Archived' },
    },
    database_id: NOTION_PAGE_ID,
  };

  const archivedPages = await fetchNotionPages(
    NOTION_CLIENT,
    archivedNotionParams
  );

  const allKnownNotionIds = new Set([
    ...pagesWithoutArchived.map((p) => p.id),
    ...archivedPages.map((p) => p.id),
  ]);

  await deleteOrphanedGoogleEvents(
    GOOGLE_AUTH,
    GOOGLE_CALENDAR_ID,
    allKnownNotionIds,
    existingCalendarEvents
  );

  const filename = config.logger.filename;
  const filepath = config.logger.path;
  const logFilePath =
    (filepath.endsWith('/') ? filepath : filepath + '/') +
    (filename.startsWith('/') ? filename.substring(1) : filename);
  const content = fs.readFileSync(logFilePath, 'utf-8');
  await MAIL_SERVICE.sendMail({
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
