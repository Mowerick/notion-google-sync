import { Client } from '@notionhq/client';
import { QueryDatabaseParameters } from '@notionhq/client/build/src/api-endpoints';
import fs from 'fs';
import { JWT } from 'google-auth-library'; // OAuth2Client for authentication

import config from 'config';
import createCalendarEvent, { EventInput, ServiceAccountKey } from 'google';
import fetchNotionPage from 'notion';

async function main() {
  const notionClient = new Client({ auth: config.notion.api.token });
  const serviceAccountKey: ServiceAccountKey = JSON.parse(
    fs.readFileSync(config.google.api.serviceAccountKey, 'utf-8')
  );

  const googleAuth = new JWT({
    email: serviceAccountKey.client_email,
    key: serviceAccountKey.private_key,
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
    const tags = page.tags.length === 0 ? '' : page.tags?.join(' ') + ': ';
    if (page.dueDateStart) {
      const dueDateStart: string = page.dueDateEnd
        ? new Date(page.dueDateStart).toISOString()
        : new Date(page.dueDateStart).toISOString().split('T')[0];

      const dueDateEnd: string = page.dueDateEnd
        ? new Date(page.dueDateEnd).toISOString()
        : new Date(page.dueDateStart).toISOString().split('T')[0];

      const date = page.dueDateEnd
        ? { startDateTime: dueDateStart, endDateTime: dueDateEnd }
        : { startDate: dueDateStart, endDate: dueDateEnd };

      const event: EventInput = {
        id: page.id,
        summary: tags + page.task,
        description: page.status + '\n' + page.description,
        ...date,
        location: page.location,
      };
      createCalendarEvent(googleAuth, googleCalendarId, event);
    }
    if (page.availableOn) {
      const availableOn: Date = new Date(page.availableOn);
      const event: EventInput = {
        id: page.id,
        summary: 'Available: ' + page.task,
        description: page.description,
        startDateTime: availableOn.toISOString(),
        endDateTime: availableOn.toISOString(),
        location: page.location,
      };
      createCalendarEvent(googleAuth, googleCalendarId, event);
    }
  });
}

main();
