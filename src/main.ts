import { Client } from '@notionhq/client';
import { QueryDatabaseParameters } from '@notionhq/client/build/src/api-endpoints';
import fs from 'fs';
import { JWT } from 'google-auth-library'; // OAuth2Client for authentication

import config from 'config';
import createOrUpdateCalendarEvent, {
  EventInput,
  ServiceAccountKey,
} from 'google';
import fetchNotionPage from 'notion';

async function main() {
  const notionClient = new Client({ auth: config.notion.api.token });

  const gogleServiceAccountKey: ServiceAccountKey = JSON.parse(
    fs.readFileSync(config.google.api.serviceAccountKey, 'utf-8')
  );

  const googleAuth = new JWT({
    email: gogleServiceAccountKey.client_email,
    key: gogleServiceAccountKey.private_key,
    scopes: ['https://www.googleapis.com/auth/calendar'],
  });

  const googleCalendarId = config.google.calendarId;

  const databaseParam: QueryDatabaseParameters = {
    filter: {
      property: 'Status',
      status: {
        does_not_equal: 'Archived',
      },
    },
    database_id: config.notion.pageId,
  };

  const pages = await fetchNotionPage(notionClient, databaseParam);
  pages?.forEach((page) => {
    const summary = [page.type, page.class, page.task]
      .filter(Boolean)
      .join(' ');
    const description =
      `Status: ${page.status}\n` +
      `Priority: ${page.priority}\n` +
      page.description;
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
      createOrUpdateCalendarEvent(googleAuth, googleCalendarId, event);
    }
  });
}

main();
