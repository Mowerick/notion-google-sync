import { calendar_v3 } from '@googleapis/calendar';
import { GaxiosError } from 'gaxios';
import { JWT } from 'google-auth-library';
import _ from 'lodash';

import {
  destroyEvents,
  findEventsForDeletedNotionPages,
  saveEventsToDatabase,
  updateEventInDatabase,
} from 'database';
import logger from 'logger';
import { Task } from 'notion';

// Define the interface for the service account key
/**
 * ServiceAccountKey interface for Google service account credentials.
 */
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
 * Handles duplicate event errors (status 409) gracefully and logs a helpful message.
 *
 * @param auth - The Google Calendar authentication object (JWT).
 * @param calendarId - The ID of the Google Calendar where the event will be created.
 * @param event - The event object containing details like summary, description, start, end, etc.
 * @returns A promise that resolves when the event is successfully created, or rejects if there is an error.
 * @throws Will throw an error if the event creation fails for reasons other than duplicate.
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
  event: calendar_v3.Schema$Event
): Promise<void> {
  const calendar = new calendar_v3.Calendar({ auth });

  try {
    await inserEvent(calendar, calendarId, event);
  } catch (err) {
    const error = err as GaxiosError;
    const errors = error.response?.data?.error?.errors as
      | { domain: string; reason: string; message: string }[]
      | undefined;
    const isDuplicateError = errors?.some((e) => e.reason === 'duplicate');
    const status = error?.response?.status;
    if (status === 409 && isDuplicateError) {
      logger.error(
        `Error creating event: Duplicate event detected for ${event.summary}, it seems event was deleted from database but notion page is still getting returned.`
      );
    } else {
      logger.error('Error creating event:', error);
      throw error;
    }
  }
}

/**
 * Helper function to insert an event into Google Calendar and save it to the database.
 *
 * @param calendar - The Google Calendar API client.
 * @param calendarId - The ID of the Google Calendar.
 * @param event - The event object to insert.
 * @returns A promise that resolves when the event is created and saved.
 * @throws Throws an error if the event creation fails.
 */
async function inserEvent(
  calendar: calendar_v3.Calendar,
  calendarId: string,
  event: calendar_v3.Schema$Event
) {
  const createResponse = await calendar.events.insert({
    calendarId: calendarId,
    requestBody: { ...event },
  });

  if (/^2\d\d$/.test(createResponse.status.toString()) && createResponse.data) {
    await saveEventsToDatabase([createResponse.data]);
    logger.info(`Event created: ${createResponse.data.htmlLink}`);
  } else {
    throw new Error();
  }
}

/**
 * Updates an existing event in Google Calendar if any fields have changed.
 *
 * @param auth - The Google Calendar authentication object (JWT).
 * @param calendarId - The ID of the Google Calendar where the event exists.
 * @param event - The event object containing the new details for the update.
 * @param existingEvent - The existing event object to compare against.
 * @returns A promise that resolves when the event is successfully updated, or if no changes were detected.
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
    const date: Date = existingEvent.start?.date
      ? new Date(existingEvent.start.date)
      : new Date(existingEvent.start?.dateTime || '');
    logger.info(
      `No updated fields for: ${existingEvent.summary} Date: ${date.toLocaleDateString() + ' ' + (existingEvent.start?.date ? '' : date.toLocaleTimeString() + ' --> ' + new Date(existingEvent.end?.dateTime || '').toLocaleTimeString())}`
    );
    return;
  }

  try {
    const updateResponse = await calendar.events.update({
      calendarId,
      eventId: id ? id : undefined, // need this ternary operator otherwise update wont take it
      requestBody: {
        ...spreadedEvent,
      },
    });

    if (
      /^2\d\d$/.test(updateResponse.status.toString()) &&
      updateResponse.data
    ) {
      await updateEventInDatabase(event);
      logger.info(`Event updated: ${updateResponse.data.htmlLink}`);
    } else {
      const error = updateResponse as unknown as GaxiosError;
      logger.error(
        `Error updating event: ${error.response?.config.data.summary}`,
        error.response?.data.errors[0]?.message
      );
    }
  } catch (error) {
    logger.error('Error updating event: ', error);
    throw error;
  }
}

/**
 * Fetches upcoming events from Google Calendar starting from the current date and time.
 *
 * @param auth - The Google Calendar authentication object (JWT).
 * @param calendarId - The ID of the Google Calendar from which to fetch events.
 * @returns A promise that resolves to an array of events starting from the current date and time.
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
    timeMin: new Date().toISOString(), // Only future events
  });

  const events = res.data.items || [];
  return events;
}

/**
 * Deletes Google Calendar events that no longer have a corresponding Notion page.
 *
 * @param pages - Array of current Notion Task objects.
 * @param auth - The Google Calendar authentication object (JWT).
 * @param calendarId - The ID of the Google Calendar.
 * @returns A promise that resolves when all orphaned events are deleted.
 */
export async function deleteEventsForDeletedNotionPages(
  pages: Task[],
  auth: JWT,
  calendarId: string
): Promise<void> {
  const eventsToDelete = await findEventsForDeletedNotionPages(pages);

  const calendar = new calendar_v3.Calendar({ auth });

  eventsToDelete.forEach(async (event) => {
    logger.info(
      `Event info: Notionpage was deleted so Google Event ${event.summary} was deleted aswell.`
    );
    await calendar.events.delete({
      calendarId,
      eventId: event.id!, // must match the ID you're trying to reuse
    });
  });

  await destroyEvents(eventsToDelete);
}
