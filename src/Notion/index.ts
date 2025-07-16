import { Client } from '@notionhq/client';
import {
  DatePropertyItemObjectResponse,
  QueryDatabaseParameters,
  RichTextItemResponse,
  SelectPropertyItemObjectResponse,
  StatusPropertyItemObjectResponse,
} from '@notionhq/client/build/src/api-endpoints';

import { destroyArchivedEvent } from 'database';
import logger from 'logger';

export interface Task {
  id: string;
  status: string;
  task: string;
  dateStart: string;
  dateEnd: string;
  className: string;
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
 * @property {string} className - The class or category associated with the task (from the "Class" property).
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
export async function fetchNotionPage(
  notionClient: Client,
  param: QueryDatabaseParameters
): Promise<Array<Task>> {
  try {
    const response = await notionClient.databases.query(param);

    const tasks = await Promise.all(
      response.results.map(async (page) => {
        if (!('properties' in page)) {
          logger.error('Invalid page object');
          throw Error('Invalid page object');
        }

        const properties = page.properties;

        const status =
          (properties['Status'] as StatusPropertyItemObjectResponse).status
            ?.name || '';
        const type =
          (properties['Type'] as SelectPropertyItemObjectResponse).select
            ?.name || '';
        const task =
          (properties['Task'] as TitleObjectResponse).title[0]?.plain_text ||
          '';
        const dateStart =
          (properties['Date'] as DatePropertyItemObjectResponse).date?.start ||
          '';
        const dateEnd =
          (properties['Date'] as DatePropertyItemObjectResponse).date?.end ||
          '';
        const className =
          (properties['Class'] as SelectPropertyItemObjectResponse).select
            ?.name || '';
        const priority =
          (
            properties['Priority'] as SelectPropertyItemObjectResponse
          ).select?.name?.toLowerCase() || '';
        const description =
          (properties['Description'] as unknown as RichTextObjectRespone)
            .rich_text[0]?.plain_text || '';
        const location =
          (properties['Location'] as unknown as RichTextObjectRespone)
            .rich_text[0]?.plain_text || '';

        return {
          id: page.id?.split('-').join('') || '',
          status,
          task,
          dateStart,
          dateEnd,
          className,
          type,
          priority,
          description,
          location,
        };
      })
    );
    const logMsg =
      tasks.length === 1
        ? 'Process 1 notion task'
        : `Processed all ${tasks.length} notion tasks`;
    logger.info(logMsg);
    return tasks;
  } catch (error) {
    logger.error(error);
    return [];
  }
}

/**
 * Archives tasks that are marked as "Done" and are older than a specified duration.
 *
 * This function iterates through an array of tasks, checks if their status is "Done",
 * and determines if they are older than the specified duration (3 days). If so, it updates
 * their status to "Archived" in Notion and deletes the corresponding event in the SQLite database.
 *
 * @async
 * @function archiveOldTasks
 * @param {Array<Task>} tasks - An array of Task objects to be processed.
 * @param {Client} notionClient - An instance of the Notion Client SDK used to update tasks.
 * @returns {Promise<void>} A promise that resolves when all eligible tasks are archived.
 */
export async function archiveOldTasks(
  tasks: Array<Task>,
  notionClient: Client
): Promise<void> {
  const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000; // 3 days in milliseconds
  const now = new Date();

  await Promise.all(
    tasks.map(async (task) => {
      if (task.status === 'Done') {
        const date = task.dateEnd
          ? new Date(task.dateEnd)
          : new Date(task.dateStart);
        const timeDiff = now.getTime() - date.getTime();
        if (timeDiff >= THREE_DAYS_MS) {
          // Update task status to "Archived" in Notion
          try {
            await notionClient.pages.update({
              page_id: task.id,
              properties: {
                Status: {
                  status: {
                    name: 'Archived',
                  },
                },
              },
            });

            await destroyArchivedEvent(task.id);

            task.status = 'Archived'; // Update local task status
            logger.info(
              `Task with ID: ${task.id} and title: "${task.task}" has been archived in Notion and deletes in the sqlite database.`
            );
          } catch (error) {
            logger.error(
              `Failed to archive task with ID: ${task.id}. Error: ${error}`
            );
          }
        }
      }
    })
  );
}
