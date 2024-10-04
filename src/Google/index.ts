import { calendar_v3 } from '@googleapis/calendar';
import { JWT } from 'google-auth-library';

import logger from 'logger'; // Assuming you have a custom logger

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
  const { startDateTime, startDate, endDateTime, endDate, timezone, ...rest } =
    event;
  // Prepare the date fields based on input (all-day vs time-specific events)
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
    } catch (error: any) {
      if (error.code !== 404) {
        // Log and throw error if it's not a 'not found' error
        logger.error('Error checking for existing event: ', error);
        throw error;
      }
    }
    if (existingEvent) {
      // If the event exists, update it
      // eslint-disable-next-line @typescript-eslint/no-unused-vars, unused-imports/no-unused-vars
      const { id, ...rest } = eventRequest;
      const updateResponse = await calendar.events.update({
        calendarId: calendarId,
        eventId: event.id,
        requestBody: rest,
      });

      if (updateResponse.status === 200 && updateResponse.data) {
        logger.info(`Event updated: ${updateResponse.data.htmlLink}`);
        return updateResponse.data;
      } else {
        throw new Error('Failed to update event');
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
  } catch (error: any) {
    logger.error('Error creating or updating event: ', error);
    throw error;
  }
}

export default createOrUpdateCalendarEvent;
