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
  EventInput,
  fetchGoogleCalendarEvents,
  updateCalendarEvent,
} from 'google';
import logger from 'logger';
import fetchNotionPage from 'notion';

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
    const summary = [page.type, page.class, page.task]
      .filter(Boolean)
      .join(' ');
    const description =
      `Status: ${page.status}\n` +
      `Priority: ${page.priority}` +
      (page.description ? '\n' + page.description : '');
    if (page.dateStart) {
      const dateStart: string = page.dateEnd
        ? new Date(page.dateStart).toISOString()
        : new Date(page.dateStart).toISOString().split('T')[0];

      const dateEnd: string = page.dateEnd
        ? new Date(page.dateEnd).toISOString()
        : new Date(page.dateStart).toISOString().split('T')[0];

      const date = page.dateEnd
        ? { startDateTime: dateStart, endDateTime: dateEnd }
        : { startDate: dateStart, endDate: dateEnd };

      const event: EventInput = {
        id: page.id,
        summary,
        description,
        ...date,
        location: page.location,
        priority: page.priority,
      };
      const existingEvent = await getEvent(page.id);
      if (existingEvent)
        await updateCalendarEvent(
          GOOGLE_AUTH,
          GOOGLE_CALENDAR_ID,
          event,
          existingEvent
        );
      else await createCalendarEvent(GOOGLE_AUTH, GOOGLE_CALENDAR_ID, event);
    }
  });
}

main();
