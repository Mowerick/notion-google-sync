import { calendar_v3 } from '@googleapis/calendar/build/v3';
import { DataTypes, Model, Sequelize } from 'sequelize';

import config from 'config';

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: './database.sqlite',
  logging: config.logger.sequelizeLogging,
});

export default sequelize;

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

export async function destroyArchivedEvent(id: string): Promise<number> {
  const result = await Event.destroy({
    where: {
      id,
    },
  });

  return result;
}

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
