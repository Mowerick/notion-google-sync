import { calendar_v3 } from '@googleapis/calendar';
import { Client } from '@notionhq/client';
import { QueryDatabaseParameters } from '@notionhq/client/build/src/api-endpoints';
import { JWT } from 'google-auth-library'; // OAuth2Client for authentication

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
import fetchNotionPage, { Task } from 'notion';

const GOOGLE_AUTH = new JWT({
  email: config.google.api.serviceAccountKey?.client_email,
  key: config.google.api.serviceAccountKey?.private_key,
  scopes: ['https://www.googleapis.com/auth/calendar'],
});

const NOTION_CLIENT = new Client({ auth: config.notion.api.token });

const GOOGLE_CALENDAR_ID = config.google.calendarId;

const NOTION_PAGE_ID = config.notion.pageId;

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
  pages?.forEach(async (page) => {
    if (!page.dateStart) {
      logger.error(`Page: ${page.task} got no Date, creation cancelled`);
      return;
    }
    const event: calendar_v3.Schema$Event =
      convertNotionTaskToCalendarEvent(page);
    const existingEvent = await getEvent(page.id);
    if (existingEvent)
      await updateCalendarEvent(
        GOOGLE_AUTH,
        GOOGLE_CALENDAR_ID,
        page.priority,
        event,
        existingEvent
      );
    else
      await createCalendarEvent(
        GOOGLE_AUTH,
        GOOGLE_CALENDAR_ID,
        page.priority,
        event
      );
  });
}

function convertNotionTaskToCalendarEvent(
  page: Task
): calendar_v3.Schema$Event {
  const {
    dateEnd,
    dateStart,
    description,
    priority,
    status,
    className,
    task,
    type,
    id,
    location,
  } = page;

  const summary = [type, className, task].filter(Boolean).join(' ');

  const eventDescription =
    `Status: ${status}\n` +
    `Priority: ${priority}` +
    (description ? '\n' + description : '');

  const formatDate = (dateStr: string, includeTime: boolean) => {
    const isoString = new Date(dateStr).toISOString();
    return includeTime ? isoString : isoString.split('T')[0];
  };

  const date = dateEnd
    ? {
        start: {
          dateTime: formatDate(dateStart, true),
          timeZone: 'UTC',
        },
        end: {
          dateTime: formatDate(dateEnd, true),
          timeZone: 'UTC',
        },
      }
    : {
        start: {
          date: formatDate(dateStart, false),
        },
        end: {
          date: formatDate(dateStart, false),
        },
      };

  const eventRequest: calendar_v3.Schema$Event = {
    id,
    location,
    description: eventDescription,
    summary,
    ...date,
  };

  return eventRequest;
}

main();
