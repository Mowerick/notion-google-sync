import { calendar_v3 } from '@googleapis/calendar';
import { GaxiosError } from 'gaxios';
import { JWT } from 'google-auth-library';
import _ from 'lodash';

import logger from 'logger';

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
        `Error creating event: Duplicate event detected for ${event.summary}.`
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
    logger.info(`Event created: ${createResponse.data.htmlLink}`);
  } else {
    logger.error(`Error creating event: ${event.summary}`);
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
  updatedEvent: calendar_v3.Schema$Event,
  existingEvent: calendar_v3.Schema$Event
): Promise<void> {
  if (!updatedEvent || !updatedEvent.id) return;
  const { id, ...spreadedEvent } = updatedEvent;
  const calendar = new calendar_v3.Calendar({ auth });

  const fieldsToCompare = [
    'summary',
    'description',
    'start',
    'end',
    'location',
  ];

  const updatedClean = normalizeFalsy(_.pick(updatedEvent, fieldsToCompare));
  const existingClean = normalizeFalsy(_.pick(existingEvent, fieldsToCompare));

  const fieldsUpdated: boolean = !_.isEqual(updatedClean, existingClean);
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

const normalizeFalsy = (obj: Record<string, any>) =>
  _.pickBy(obj, (v) => !(v === '' || v === null || v === undefined));

/**
 * Fetches relevant events from Google Calendar (from 4 days ago onward),
 * following pagination until all pages are retrieved.
 *
 * @param auth - Google Calendar authentication object (JWT)
 * @param calendarId - The ID of the Google Calendar
 * @returns All events starting from (now - 4 days)
 */
export async function fetchRelevantGoogleCalendarEvents(
  auth: JWT,
  calendarId: string
): Promise<calendar_v3.Schema$Event[]> {
  const calendar = new calendar_v3.Calendar({ auth }); // ✅ same init as before

  const ONE_MONTH_MS = 30 * 24 * 60 * 60 * 1000;
  const timeMin = new Date(Date.now() - ONE_MONTH_MS).toISOString();

  let allEvents: calendar_v3.Schema$Event[] = [];
  let pageToken: string | undefined;

  do {
    await new Promise((res) => setTimeout(res, 100));
    const res = await calendar.events.list({
      calendarId,
      singleEvents: true,
      orderBy: 'startTime',
      timeMin,
      maxResults: 2500,
      pageToken,
    });

    // ✅ Proper type-safe access
    if (res.data.items && res.data.items.length > 0) {
      allEvents = allEvents.concat(res.data.items);
    }

    pageToken = res.data.nextPageToken || undefined;
  } while (pageToken);

  return allEvents;
}

/**
 * Deletes orphaned Google Calendar events that no longer exist in Notion.
 *
 * This function ensures that only events whose Notion pages have been deleted
 * (not archived) are removed from the Google Calendar.
 *
 * @param auth - The Google Calendar authentication object (JWT)
 * @param calendarId - The ID of the Google Calendar
 * @param knownNotionIds - A Set of all Notion page IDs (including active and archived)
 * @returns A promise that resolves when all orphaned events have been processed
 */
export async function deleteOrphanedGoogleEvents(
  auth: JWT,
  calendarId: string,
  knownNotionIds: Set<string>,
  allEvents: calendar_v3.Schema$Event[]
): Promise<void> {
  const calendar = new calendar_v3.Calendar({ auth });

  try {
    for (const event of allEvents) {
      if (!event.id) continue;

      if (!knownNotionIds.has(event.id)) {
        try {
          await new Promise((res) => setTimeout(res, 200)); // rate-limit safety delay
          await calendar.events.delete({ calendarId, eventId: event.id });
          logger.info(
            `Deleted orphaned Google Calendar event: ${event.summary || event.id}`
          );
        } catch (error) {
          const err = error as GaxiosError;
          if (err.response?.status === 404) {
            logger.warn(`Event ${event.id} already deleted or not found.`);
          } else {
            logger.error(
              `Failed to delete orphaned event ${event.id}:`,
              err.message
            );
          }
        }
      }
    }

    logger.info('Google Calendar orphan cleanup completed.');
  } catch (error) {
    logger.error('Error during Google Calendar orphan cleanup:', error);
  }
}
