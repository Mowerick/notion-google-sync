import { calendar_v3 } from '@googleapis/calendar'; // Import from @googleapis/calendar
import { JWT } from 'google-auth-library'; // OAuth2Client for authentication

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

async function createCalendarEvent(
  authClient: JWT, // Authenticated OAuth2 client
  calendarId: string, // Google Calendar ID
  event: EventInput
): Promise<calendar_v3.Schema$Event> {
  const calendar = new calendar_v3.Calendar({ auth: authClient });
  const date = event.startDateTime
    ? {
        start: {
          dateTime: event.startDateTime,
          timeZone: event.timezone || 'UTC',
        },
        end: {
          dateTime: event.endDateTime,
          timeZone: event.timezone || 'UTC',
        },
      }
    : {
        start: {
          date: event.startDate,
        },
        end: {
          date: event.endDate,
        },
      };

  // Create the event request body based on input
  const eventRequest: calendar_v3.Schema$Event = {
    summary: event.summary,
    description: event.description || '',
    ...date,
    attendees:
      event.attendees?.map((attendee) => ({ email: attendee.email })) || [],
    location: event.location || '',
  };

  try {
    // Insert the event into the calendar
    const response = await calendar.events.insert({
      calendarId: calendarId,
      requestBody: eventRequest,
    });

    if (response.status === 200 && response.data) {
      logger.info(`Event created: ${response.data.htmlLink}`);
      return response.data;
    } else {
      throw new Error('Failed to create event');
    }
  } catch (error) {
    logger.error('Error creating event: ', error);
  }

  return {};
}

export default createCalendarEvent;
