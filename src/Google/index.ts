import { calendar_v3, auth as googleAuth } from '@googleapis/calendar'; // Import from @googleapis/calendar
import { OAuth2Client } from 'google-auth-library'; // OAuth2Client for authentication
import logger from 'logger'; // Assuming you have a custom logger

// Define the structure for event input
interface EventInput {
  summary: string;
  description?: string;
  startDateTime: string; // ISO format
  endDateTime: string; // ISO format
  attendees?: Array<{ email: string }>;
  location?: string;
  timezone?: string;
}

async function createCalendarEvent(
  authClient: OAuth2Client, // Authenticated OAuth2 client
  calendarId: string, // Google Calendar ID
  event: EventInput // Event details
): Promise<calendar_v3.Schema$Event> {
  const calendar = new calendar_v3.Calendar({ auth: authClient });

  // Create the event request body based on input
  const eventRequest: calendar_v3.Schema$Event = {
    summary: event.summary,
    description: event.description || '',
    start: {
      dateTime: event.startDateTime,
      timeZone: event.timezone || 'UTC',
    },
    end: {
      dateTime: event.endDateTime,
      timeZone: event.timezone || 'UTC',
    },
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
