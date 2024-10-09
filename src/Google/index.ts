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

// Function to create a new calendar event
export async function createCalendarEvent(
  auth: JWT,
  calendarId: string,
  event: EventInput
): Promise<void> {
  const calendar = new calendar_v3.Calendar({ auth });

  try {
    const createResponse = await calendar.events.insert({
      calendarId: calendarId,
      requestBody: {
        ...convertNotionEventToCalendarEvent(event),
        reminders: getRemindersByPriority(event.priority),
      },
    });

    if (createResponse.status === 200 && createResponse.data) {
      logger.info(`Event created: ${createResponse.data.htmlLink}`);
    } else {
      throw new Error('Failed to create event');
    }
  } catch (error) {
    logger.error('Error creating event: ', error);
    throw error;
  }
}

// Function to update an existing calendar event
export async function updateCalendarEvent(
  auth: JWT,
  calendarId: string,
  event: EventInput,
  existingEvent: calendar_v3.Schema$Event
): Promise<void> {
  const calendar = new calendar_v3.Calendar({ auth });
  const updatedEvent: calendar_v3.Schema$Event =
    convertNotionEventToCalendarEvent(event);
  const fieldsToCompare = [
    'summary',
    'description',
    'start',
    'end',
    'location',
  ];

  const fieldsUpdated: boolean = !_.isEqual(
    _.pick(updatedEvent, fieldsToCompare),
    _.pick(existingEvent, fieldsToCompare)
  );

  if (!fieldsUpdated) return;

  try {
    const updateResponse = await calendar.events.update({
      calendarId: calendarId,
      eventId: event.id,
      requestBody: updatedEvent,
    });

    if (updateResponse.status === 200 && updateResponse.data) {
      logger.info(`Event updated: ${updateResponse.data.htmlLink}`);
    } else {
      throw new Error('Failed to update event');
    }
  } catch (error) {
    logger.error('Error updating event: ', error);
    throw error;
  }
}

export async function fetchGoogleCalendarEvents(
  auth: JWT,
  calendarId: string
): Promise<calendar_v3.Schema$Event[]> {
  const calendar = new calendar_v3.Calendar({ auth });

  const now = new Date().toISOString();

  const res = await calendar.events.list({
    calendarId,
    timeMin: now,
    singleEvents: true,
    orderBy: 'startTime',
  });

  const events = res.data.items || [];

  return events;
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

function convertNotionEventToCalendarEvent(
  event: EventInput
): calendar_v3.Schema$Event {
  const { startDateTime, startDate, endDateTime, endDate, timezone, ...rest } =
    event;

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

  const eventRequest: calendar_v3.Schema$Event = {
    ...rest,
    ...date,
  };

  return eventRequest;
}
