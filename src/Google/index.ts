import { calendar_v3 } from '@googleapis/calendar';
import { JWT } from 'google-auth-library';
import _ from 'lodash';

import { updateEventInDatabase } from 'database';
import logger from 'logger';

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

/**
 * Creates a new event in Google Calendar based on the provided event details.
 *
 * @async
 * @function createCalendarEvent
 * @param {JWT} auth - The Google Calendar authentication object (JWT) used to authenticate API requests.
 * @param {string} calendarId - The ID of the Google Calendar where the event will be created.
 * @param {string} priority - The priority of the event (e.g., 'low', 'medium', 'high'), which determines the reminder settings.
 * @param {calendar_v3.Schema$Event} event - The event object containing details like summary, description, start, end, etc.
 * @returns {Promise<void>} A promise that resolves when the event is successfully created, or rejects if there is an error.
 *
 * @throws Will throw an error if the event creation fails.
 *
 * @example
 * const auth = new JWT({
 *   email: client_email,
 *   key: private_key,
 *   scopes: ['https://www.googleapis.com/auth/calendar'],
 * });
 *
 * const event = {
 *   summary: 'Meeting with Team',
 *   start: {
 *     dateTime: '2024-10-15T10:00:00-07:00',
 *   },
 *   end: {
 *     dateTime: '2024-10-15T11:00:00-07:00',
 *   },
 * };
 *
 * await createCalendarEvent(auth, 'primary', 'high', event);
 */
export async function createCalendarEvent(
  auth: JWT,
  calendarId: string,
  priority: string,
  event: calendar_v3.Schema$Event
): Promise<void> {
  const calendar = new calendar_v3.Calendar({ auth });

  try {
    const createResponse = await calendar.events.insert({
      calendarId: calendarId,
      requestBody: {
        ...event,
        reminders: getRemindersByPriority(priority),
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

/**
 * Updates an existing event in Google Calendar if any fields have changed.
 *
 * @async
 * @function updateCalendarEvent
 * @param {JWT} auth - The Google Calendar authentication object (JWT) used to authenticate API requests.
 * @param {string} calendarId - The ID of the Google Calendar where the event exists.
 * @param {string} priority - The priority of the event (e.g., 'low', 'medium', 'high'), which determines the reminder settings.
 * @param {calendar_v3.Schema$Event} event - The event object containing the new details for the update.
 * @param {calendar_v3.Schema$Event} existingEvent - The existing event object to compare against.
 * @returns {Promise<void>} A promise that resolves when the event is successfully updated, or if no changes were detected.
 *
 * @throws Will throw an error if the event update fails.
 *
 * @example
 * const existingEvent = {
 *   summary: 'Meeting with Team',
 *   start: {
 *     dateTime: '2024-10-15T10:00:00-07:00',
 *   },
 *   end: {
 *     dateTime: '2024-10-15T11:00:00-07:00',
 *   },
 * };
 *
 * const updatedEvent = {
 *   summary: 'Updated Meeting with Team',
 *   start: {
 *     dateTime: '2024-10-15T10:00:00-07:00',
 *   },
 *   end: {
 *     dateTime: '2024-10-15T12:00:00-07:00',
 *   },
 * };
 *
 * await updateCalendarEvent(auth, 'primary', 'medium', updatedEvent, existingEvent);
 */
export async function updateCalendarEvent(
  auth: JWT,
  calendarId: string,
  priority: string,
  event: calendar_v3.Schema$Event,
  existingEvent: calendar_v3.Schema$Event
): Promise<void> {
  const { id, ...spreadedEvent } = event;
  const calendar = new calendar_v3.Calendar({ auth });
  const fieldsToCompare = [
    'summary',
    'description',
    'start',
    'end',
    'location',
  ];

  const fieldsUpdated: boolean = !_.isEqual(
    _.pick(event, fieldsToCompare),
    _.pick(existingEvent, fieldsToCompare)
  );

  if (!fieldsUpdated) {
    logger.info(
      `No updated fields for: ${existingEvent.summary} Date: ${existingEvent.start?.date ? existingEvent.start.date : existingEvent.start?.dateTime}`
    );
    return;
  }

  try {
    const updateResponse = await calendar.events.update({
      calendarId,
      eventId: id ? id : undefined, // need this ternary operator otherwise update wont take it
      requestBody: {
        ...spreadedEvent,
        reminders: getRemindersByPriority(priority),
      },
    });

    if (updateResponse.status === 200 && updateResponse.data) {
      await updateEventInDatabase(event);
      logger.info(`Event updated: ${updateResponse.data.htmlLink}`);
    } else {
      throw new Error('Failed to update event');
    }
  } catch (error) {
    logger.error('Error updating event: ', error);
    throw error;
  }
}

/**
 * Fetches upcoming events from Google Calendar starting from the current date and time.
 *
 * @async
 * @function fetchGoogleCalendarEvents
 * @param {JWT} auth - The Google Calendar authentication object (JWT) used to authenticate API requests.
 * @param {string} calendarId - The ID of the Google Calendar from which to fetch events.
 * @returns {Promise<calendar_v3.Schema$Event[]>} A promise that resolves to an array of events starting from the current date and time.
 *
 * @example
 * const events = await fetchGoogleCalendarEvents(auth, 'primary');
 * events.forEach(event => console.log(event.summary));
 */
export async function fetchGoogleCalendarEvents(
  auth: JWT,
  calendarId: string
): Promise<calendar_v3.Schema$Event[]> {
  const calendar = new calendar_v3.Calendar({ auth });

  const res = await calendar.events.list({
    calendarId,
    singleEvents: true,
    orderBy: 'startTime',
  });

  const events = res.data.items || [];

  return events;
}

/**
 * Returns reminder settings based on the priority level.
 *
 * @function getRemindersByPriority
 * @param {string} priority - The priority of the event (e.g., 'low', 'medium', 'high').
 * @returns {Reminders} The reminders settings for the event.
 *
 * @example
 * const reminders = getRemindersByPriority('high');
 * console.log(reminders);
 */
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
