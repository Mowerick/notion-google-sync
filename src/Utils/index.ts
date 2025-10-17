import { calendar_v3 } from '@googleapis/calendar';

import { Task } from 'notion';

/**
 * Converts a Notion task object into a Google Calendar event object.
 *
 * @param page - The Notion task to convert. Should contain properties such as dateStart, dateEnd, description, priority, status, className, task, type, id, and location.
 * @returns A Google Calendar event object (`calendar_v3.Schema$Event`) representing the Notion task.
 *
 * @remarks
 * - The function constructs the event summary by concatenating the type, className, and task fields.
 * - The event description includes the status, priority, and optionally the task description.
 * - Determines whether to use date or dateTime fields based on the presence of time in the date strings.
 * - If both dateStart and dateEnd are present and contain time, uses dateTime fields; otherwise, uses date fields.
 * - The event's time zone is set to 'UTC' if time is included.
 */
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
    const date = new Date(dateStr);

    const pad = (n: number) => n.toString().padStart(2, '0');

    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());

    if (!includeTime) {
      return `${year}-${month}-${day}`;
    }

    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());
    const seconds = pad(date.getSeconds());

    // timezone offset in minutes → format as ±HH:MM
    const offsetMinutes = date.getTimezoneOffset();
    const sign = offsetMinutes > 0 ? '-' : '+';
    const absOffset = Math.abs(offsetMinutes);
    const offsetHours = pad(Math.floor(absOffset / 60));
    const offsetMins = pad(absOffset % 60);

    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}${sign}${offsetHours}:${offsetMins}`;
  };

  const hasTime = (dateString: string) => {
    // Regular expression to match time in the format HH:mm or HH:mm:ss
    const timeRegex = /\d{2}:\d{2}(?::\d{2})?/;
    return timeRegex.test(dateString);
  };
  const hasEndDate = !!dateEnd;
  const isDateTime = (hasEndDate && hasTime(dateEnd)) || hasTime(dateStart);
  const useDateTimeFormat = (date: string) => formatDate(date, true);
  const useDateFormat = (date: string) => formatDate(date, false);

  let date;
  // covers enabled include time
  if (isDateTime) {
    // covers enabled end date and disabled end date
    const endDateTime = !hasEndDate ? dateStart : dateEnd;

    date = {
      start: {
        dateTime: useDateTimeFormat(dateStart),
        timeZone: 'UTC',
      },
      end: {
        dateTime: useDateTimeFormat(endDateTime),
        timeZone: 'UTC',
      },
    };
  } else if (hasEndDate) {
    // covers enabled end date and disabled include time
    date = {
      start: {
        date: useDateFormat(dateStart),
      },
      end: {
        date: useDateFormat(dateEnd),
      },
    };
  } else {
    // covers both disabled include time and end date
    date = {
      start: {
        date: useDateFormat(dateStart),
      },
      end: {
        date: useDateFormat(dateStart),
      },
    };
  }
  const eventRequest: calendar_v3.Schema$Event = {
    id,
    location,
    description: eventDescription,
    summary,
    ...date,
  };

  return eventRequest;
}
