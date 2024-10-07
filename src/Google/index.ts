import { calendar_v3 } from '@googleapis/calendar';
import { JWT } from 'google-auth-library';
import _ from 'lodash';

import logger from 'logger';

// Define the structure for event input
export interface EventInput {
  id: string;
  summary: string;
  description?: string;
  startDateTime?: string; // ISO format
  endDateTime?: string; // ISO format
  startDate?: string;
  endDate?: string;
  attendees?: Array<{ email: string }>;
  location?: string;
  timezone?: string;
  priority: string;
}

interface Reminders {
  useDefault: boolean;
  overrides: Array<{
    method: string;
    minutes: number;
  }>;
}

// Define the interface for the service account key
export interface ServiceAccountKey {
  type: string;
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  auth_uri: string;
  token_uri: string;
  auth_provider_x509_cert_url: string;
  client_x509_cert_url: string;
}

// Function to create or update a calendar event
export async function createOrUpdateCalendarEvent(
  authClient: JWT, // Authenticated OAuth2 client
  calendarId: string, // Google Calendar ID
  event: EventInput // Event details to insert or update
): Promise<calendar_v3.Schema$Event | undefined> {
  const calendar = new calendar_v3.Calendar({ auth: authClient });
  const {
    startDateTime,
    startDate,
    endDateTime,
    endDate,
    timezone,
    priority,
    ...rest
  } = event;

  const date = startDateTime
    ? {
        start: {
          dateTime: startDateTime,
          timeZone: timezone || 'UTC',
        },
        end: {
          dateTime: endDateTime,
          timeZone: timezone || 'UTC',
        },
      }
    : {
        start: {
          date: startDate,
        },
        end: {
          date: endDate,
        },
      };

  // Create the event request body based on input
  const eventRequest: calendar_v3.Schema$Event = {
    ...rest,
    ...date,
    reminders: getRemindersByPriority(priority),
  };

  try {
    // Check if the event with the given ID exists in the calendar
    let existingEvent: calendar_v3.Schema$Event | null = null;
    try {
      existingEvent = await calendar.events
        .get({
          calendarId: calendarId,
          eventId: event.id,
        })
        .then((response) => response.data);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      if (error.code !== 404) {
        // Log and throw error if it's not a 'not found' error
        logger.error('Error checking for existing event: ', error);
        throw error;
      }
    }

    const fieldsToCompare = [
      'summary',
      'description',
      'start',
      'end',
      'timezone',
      'attendees',
      'location',
    ];

    if (existingEvent) {
      const fieldsUpdated: boolean = !_.isEqual(
        _.pick(eventRequest, fieldsToCompare),
        _.pick(existingEvent, fieldsToCompare)
      );
      if (fieldsUpdated) {
        const updateResponse = await calendar.events.update({
          calendarId: calendarId,
          eventId: event.id,
          requestBody: eventRequest,
        });

        if (updateResponse.status === 200 && updateResponse.data) {
          logger.info(`Event updated: ${updateResponse.data.htmlLink}`);
          return updateResponse.data;
        } else {
          throw new Error('Failed to update event');
        }
      }
    } else {
      // If the event does not exist, create a new one
      const createResponse = await calendar.events.insert({
        calendarId: calendarId,
        requestBody: eventRequest,
      });

      if (createResponse.status === 200 && createResponse.data) {
        logger.info(`Event created: ${createResponse.data.htmlLink}`);
        return createResponse.data;
      } else {
        throw new Error('Failed to create event');
      }
    }
  } catch (error) {
    logger.error('Error creating or updating event: ', error);
    throw error;
  }
}

function getRemindersByPriority(priority: string): Reminders {
  const reminders = [];

  // Push low priority reminders (7-day intervals)
  if (priority === 'low' || priority === 'medium' || priority === 'high') {
    reminders.push({ method: 'email', minutes: 14 * 24 * 60 }); // 14 days before
  }

  // Push medium priority reminders (2-day intervals)
  if (priority === 'medium' || priority === 'high') {
    reminders.push({ method: 'email', minutes: 6 * 24 * 60 }); // 7 days before
  }

  // Push high priority reminders (daily intervals)
  if (priority === 'high') {
    reminders.push({ method: 'email', minutes: 24 * 60 }); // 1 day before
    reminders.push({ method: 'email', minutes: 48 * 60 }); // 2 days before
    reminders.push({ method: 'email', minutes: 72 * 60 }); // 3 days before
  }

  return {
    useDefault: false,
    overrides: reminders,
  };
}

export default createOrUpdateCalendarEvent;
