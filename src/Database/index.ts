import { calendar_v3 } from '@googleapis/calendar/build/v3';
import { DataTypes, Model, Op, Sequelize } from 'sequelize';

import config from 'config';
import { Task } from 'notion';

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: './database.sqlite',
  logging: config.logger.sequelizeLogging,
});

export default sequelize;

/**
 * Saves events to the SQLite database.
 *
 * This function iterates through an array of Google Calendar events and saves them to the SQLite database.
 * If an event already exists, it is not duplicated.
 *
 * @async
 * @function saveEventsToDatabase
 * @param {Array<calendar_v3.Schema$Event>} events - An array of Google Calendar events to be saved.
 * @returns {Promise<void>} A promise that resolves when all events are saved.
 */
export async function saveEventsToDatabase(
  events: calendar_v3.Schema$Event[]
): Promise<void> {
  for (const event of events) {
    const date = event.start?.dateTime
      ? {
          start: event.start?.dateTime,
          end: event.end?.dateTime,
          allDay: false,
        }
      : {
          start: event.start?.date,
          end: event.end?.date,
          allDay: true,
        };
    await Event.findOrCreate({
      where: { id: event.id },
      defaults: {
        summary: event.summary,
        description: event.description,
        location: event.location,
        ...date,
      },
    });
  }
}

/**
 * Updates an event in the SQLite database.
 *
 * This function checks if the event exists in the database. If it does, the event's details are updated.
 * If it does not exist, the event is created.
 *
 * @async
 * @function updateEventInDatabase
 * @param {calendar_v3.Schema$Event} event - The Google Calendar event to be updated or created.
 * @returns {Promise<void>} A promise that resolves when the event is updated or created.
 */
export async function updateEventInDatabase(
  event: calendar_v3.Schema$Event
): Promise<void> {
  const date = event.start?.dateTime
    ? {
        start: event.start?.dateTime,
        end: event.end?.dateTime,
        allDay: false,
      }
    : {
        start: event.start?.date,
        end: event.end?.date,
        allDay: true,
      };

  const [existingEvent, created] = await Event.findOrCreate({
    where: { id: event.id },
    defaults: {
      summary: event.summary,
      description: event.description,
      location: event.location,
      ...date,
    },
  });

  if (!created) {
    // If the event already exists, update the event's details
    await existingEvent.update({
      summary: event.summary,
      description: event.description,
      location: event.location,
      ...date,
    });
  }
}

/**
 * Deletes an archived event from the SQLite database.
 *
 * This function removes the event associated with the given task ID from the SQLite database.
 *
 * @async
 * @function destroyArchivedEvent
 * @param {string} id - The unique identifier of the event to be deleted.
 * @returns {Promise<number>} A promise that resolves to the number of rows deleted.
 */
export async function destroyArchivedEvent(id: string): Promise<number> {
  const result = await Event.destroy({
    where: {
      id,
    },
  });

  return result;
}

/**
 * Deletes events that have ended before today from the SQLite database.
 *
 * This function removes all events from the database where the end date is less than today's date.
 *
 * @async
 * @function destroyEndedEvents
 * @returns {Promise<number>} A promise that resolves to the number of rows deleted.
 */
export async function destroyEndedEvents(): Promise<number> {
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Normalize to midnight

  const result = await Event.destroy({
    where: {
      end: {
        [Op.lt]: today, // Less than today
      },
    },
  });

  return result; // Number of rows deleted
}

/**
 * Retrieves an event from the SQLite database.
 *
 * This function fetches the event associated with the given event ID from the database.
 * If the event is found, its details are returned in a format compatible with Google Calendar.
 *
 * @async
 * @function getEvent
 * @param {string} eventId - The unique identifier of the event to be retrieved.
 * @returns {Promise<calendar_v3.Schema$Event | null>} A promise that resolves to the event object or null if not found.
 */
export async function getEvent(
  eventId: string
): Promise<calendar_v3.Schema$Event | null> {
  const event: Event | null = await Event.findByPk(eventId);

  if (!event) return null;

  const { description, summary, id, start, end, allDay, location } =
    event.dataValues;
  const date = allDay
    ? {
        start: {
          date: start.toISOString().split('T')[0],
        },
        end: {
          date: end.toISOString().split('T')[0],
        },
      }
    : {
        start: {
          dateTime: start.toISOString(),
          timeZone: 'UTC',
        },
        end: {
          dateTime: end.toISOString(),
          timeZone: 'UTC',
        },
      };

  return {
    description,
    summary,
    id,
    location: location ? location : '',
    ...date,
  };
}

/**
 * Finds and returns all `Event` records whose IDs do not match any of the provided Notion page IDs.
 *
 * @param pages - An array of `Task` objects representing Notion pages.
 * @returns A promise that resolves to an array of `Event` objects whose IDs are not present in the given pages.
 */
export async function findEventsForDeletedNotionPages(
  pages: Task[]
): Promise<Event[]> {
  const pageIds = pages.map((page) => page.id);
  return await Event.findAll({
    where: {
      id: {
        [Op.notIn]: pageIds,
      },
    },
  });
}

/**
 * Deletes multiple events from the database based on their IDs.
 *
 * @param events - An array of `Event` objects to be deleted. Each event's `id` will be used to identify records for deletion.
 * @returns A promise that resolves when the deletion operation is complete.
 */
export async function destroyEvents(events: Event[]): Promise<void> {
  await Event.destroy({
    where: {
      id: {
        [Op.in]: events.map((event) => event.id),
      },
    },
  });
}

export class Event extends Model {
  public id!: string;
  public summary!: string | null;
  public description!: string | null;
  public start!: Date;
  public location!: string | null;
  public allDay!: boolean;
  public end!: Date;
}

Event.init(
  {
    id: {
      type: DataTypes.STRING,
      primaryKey: true,
    },
    summary: DataTypes.STRING,
    description: DataTypes.TEXT,
    start: DataTypes.DATE,
    end: DataTypes.DATE,
    allDay: DataTypes.BOOLEAN,
    location: DataTypes.STRING,
  },
  {
    sequelize,
    modelName: 'Event',
  }
);
