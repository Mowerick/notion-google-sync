import { calendar_v3 } from '@googleapis/calendar';

import { Task } from 'notion';

export default function convertNotionTaskToCalendarEvent(
  page: Task
): calendar_v3.Schema$Event {
  const {
    dateEnd,
    dateStart,
    description,
    priority,
    status,
    className,
    task,
    type,
    id,
    location,
  } = page;

  const summary = [type, className, task].filter(Boolean).join(' ');

  const eventDescription =
    `Status: ${status}\n` +
    `Priority: ${priority}` +
    (description ? '\n' + description : '');

  const formatDate = (dateStr: string, includeTime: boolean) => {
    const isoString = new Date(dateStr).toISOString();
    return includeTime ? isoString : isoString.split('T')[0];
  };

  const date = dateEnd
    ? {
        start: {
          dateTime: formatDate(dateStart, true),
          timeZone: 'UTC',
        },
        end: {
          dateTime: formatDate(dateEnd, true),
          timeZone: 'UTC',
        },
      }
    : {
        start: {
          date: formatDate(dateStart, false),
        },
        end: {
          date: formatDate(dateStart, false),
        },
      };

  const eventRequest: calendar_v3.Schema$Event = {
    id,
    location,
    description: eventDescription,
    summary,
    ...date,
  };

  return eventRequest;
}
