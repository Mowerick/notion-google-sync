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

  const hasTime = (dateString: string) => {
    // Regular expression to match time in the format HH:mm or HH:mm:ss
    const timeRegex = /\d{2}:\d{2}(?::\d{2})?/;
    return timeRegex.test(dateString);
  };
  const date =
    (dateEnd && hasTime(dateEnd)) || hasTime(dateStart)
      ? {
          start: {
            dateTime: formatDate(dateStart, true),
            timeZone: 'UTC',
          },
          end: {
            dateTime: formatDate(
              hasTime(dateStart) && !dateEnd ? dateStart : dateEnd,
              true
            ),
            timeZone: 'UTC',
          },
        }
      : dateEnd
        ? {
            start: {
              date: formatDate(dateStart, false),
            },
            end: {
              date: formatDate(dateEnd, false),
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
