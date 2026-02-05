import { Client } from '@notionhq/client';
import {
  DatePropertyItemObjectResponse,
  QueryDatabaseParameters,
  QueryDatabaseResponse,
  RichTextItemResponse,
  SelectPropertyItemObjectResponse,
  StatusPropertyItemObjectResponse,
} from '@notionhq/client/build/src/api-endpoints';

import logger from 'logger';
import NOTION_GOOGLE_PROPERTY_MAP from 'mapping';

export interface Task {
  id: string;
  status: string;
  task: string;
  dateStart: string;
  dateEnd: string;
  category: string;
  type: string;
  priority: string;
  description: string;
  location: string;
}

interface TitleObjectResponse {
  type: 'title';
  title: Array<RichTextItemResponse>;
  id: string;
}

interface RichTextObjectRespone {
  type: 'rich_text';
  rich_text: Array<RichTextItemResponse>;
  id: string;
}

/**
 * Fetches tasks from a Notion database based on the provided query parameters.
 *
 * This function retrieves tasks from the Notion database using the given `QueryDatabaseParameters`.
 * It extracts relevant properties such as status, task name, start/end dates, class name, type, priority,
 * description, and location for each task. The tasks are returned as an array of `Task` objects.
 * If an error occurs during the fetch or processing, it logs the error and returns `undefined`.
 *
 * @async
 * @function fetchNotionPage
 * @param {Client} notionClient - An instance of the Notion Client SDK used to query the database.
 * @param {QueryDatabaseParameters} param - The parameters used to query the Notion database, such as the database ID and filters.
 * @returns {Promise<Array<Task> | undefined>} A promise that resolves to an array of Task objects, or `undefined` if an error occurs.
 *
 * @typedef {Object} Task
 * @property {string} id - The unique identifier of the task in Notion.
 * @property {string} status - The current status of the task (e.g., "Not Started", "In Progress", "Done").
 * @property {string} task - The title or name of the task.
 * @property {string} dateStart - The start date of the task (from the "Date" property).
 * @property {string} dateEnd - The end date of the task (from the "Date" property).
 * @property {string} category - The class or category associated with the task (from the "Class" property).
 * @property {string} type - The type of task (from the "Type" property, such as "Homework", "Exam").
 * @property {string} priority - The priority of the task (e.g., "high", "medium", "low").
 * @property {string} description - A brief description of the task (from the "Description" property).
 * @property {string} location - The location associated with the task, if any (from the "Location" property).
 *
 * @example
 * const notionClient = new Client({ auth: process.env.NOTION_API_KEY });
 * const queryParams = {
 *   database_id: 'YOUR_DATABASE_ID',
 *   filter: {
 *     property: 'Status',
 *     select: {
 *       equals: 'Not Started',
 *     },
 *   },
 * };
 *
 * fetchNotionPage(notionClient, queryParams)
 *   .then(tasks => {
 *     if (tasks) {
 *       tasks.forEach(task => console.log(task.task));
 *     }
 *   })
 *   .catch(error => console.error(error));
 */
export async function fetchNotionPages(
  notionClient: Client,
  params: QueryDatabaseParameters
): Promise<Array<Task>> {
  try {
    let allPages: QueryDatabaseResponse['results'] = [];
    let cursor: string | undefined = undefined;
    do {
      await new Promise((res) => setTimeout(res, 100));
      const response = await notionClient.databases.query({
        ...params,
        start_cursor: cursor,
      });

      allPages = allPages.concat(response.results);
      cursor = response.has_more ? response.next_cursor! : undefined;
    } while (cursor);

    const tasks = await Promise.all(
      allPages.map(async (page) => {
        if (!('properties' in page)) {
          logger.error('Invalid page object');
          throw Error('Invalid page object');
        }

        const properties = page.properties;

        const status =
          (
            properties[
              NOTION_GOOGLE_PROPERTY_MAP.status
            ] as StatusPropertyItemObjectResponse
          ).status?.name || '';
        const type =
          (
            properties[
              NOTION_GOOGLE_PROPERTY_MAP.type
            ] as SelectPropertyItemObjectResponse
          ).select?.name || '';
        const task =
          (
            properties[
              NOTION_GOOGLE_PROPERTY_MAP.summary
            ] as TitleObjectResponse
          ).title[0]?.plain_text || '';
        const dateStart =
          (
            properties[
              NOTION_GOOGLE_PROPERTY_MAP.start
            ] as DatePropertyItemObjectResponse
          ).date?.start || '';
        const dateEnd =
          (
            properties[
              NOTION_GOOGLE_PROPERTY_MAP.end
            ] as DatePropertyItemObjectResponse
          ).date?.end || '';
        const category =
          (
            properties[
              NOTION_GOOGLE_PROPERTY_MAP.category
            ] as SelectPropertyItemObjectResponse
          ).select?.name || '';
        const priority =
          (
            properties[
              NOTION_GOOGLE_PROPERTY_MAP.priority
            ] as SelectPropertyItemObjectResponse
          ).select?.name?.toLowerCase() || '';
        const description =
          (
            properties[
              NOTION_GOOGLE_PROPERTY_MAP.description
            ] as unknown as RichTextObjectRespone
          ).rich_text[0]?.plain_text || '';
        const location =
          (
            properties[
              NOTION_GOOGLE_PROPERTY_MAP.location
            ] as unknown as RichTextObjectRespone
          ).rich_text[0]?.plain_text || '';

        return {
          id: page.id?.split('-').join('') || '',
          status,
          task,
          dateStart,
          dateEnd,
          category,
          type,
          priority,
          description,
          location,
        };
      })
    );

    return tasks;
  } catch (error) {
    logger.error(error);
    return [];
  }
}

/**
 * Archives tasks that are marked as "Done" and are older than a specified duration.
 * Removes archived tasks from the returned list.
 *
 * @async
 * @function archiveOldTasks
 * @param {Array<Task>} tasks - An array of Task objects to be processed.
 * @param {Client} notionClient - An instance of the Notion Client SDK used to update tasks.
 * @returns {Promise<Array<Task>>} A promise resolving to the remaining (non-archived) tasks.
 */
export async function archiveOldTasks(
  tasks: Array<Task>,
  notionClient: Client
): Promise<Array<Task>> {
  const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000; // 3 days in milliseconds
  const now = new Date();

  // Array to collect tasks that are NOT archived
  const remainingTasks: Array<Task> = [];

  await Promise.all(
    tasks.map(async (task) => {
      const date = task.dateEnd
        ? new Date(task.dateEnd)
        : new Date(task.dateStart);

      const timeDiff = now.getTime() - date.getTime();
      const shouldArchive = task.status === 'Done' && timeDiff >= THREE_DAYS_MS;

      if (!shouldArchive) {
        remainingTasks.push(task);
        return;
      }

      try {
        // Archive task in Notion
        await notionClient.pages.update({
          page_id: task.id,
          properties: {
            Status: {
              status: { name: 'Archived' },
            },
          },
        });

        logger.info(
          `Task with ID: ${task.id} ("${task.task}") archived in Notion and deleted in SQLite.`
        );
      } catch (error) {
        logger.error(
          `Failed to archive task with ID: ${task.id}. Error: ${error}`
        );
        // Keep task in list if archiving failed
        remainingTasks.push(task);
      }
    })
  );

  return remainingTasks;
}
