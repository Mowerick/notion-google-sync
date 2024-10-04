import { Client } from '@notionhq/client';
import {
  DatePropertyItemObjectResponse,
  MultiSelectPropertyItemObjectResponse,
  PageObjectResponse,
  QueryDatabaseParameters,
  RichTextPropertyItemObjectResponse,
  StatusPropertyItemObjectResponse,
  TitlePropertyItemObjectResponse,
} from '@notionhq/client/build/src/api-endpoints';
import logger from 'logger';

interface Task {
  status: string | null;
  task: string | null;
  availableOn: string | null;
  dueDate: string | null;
  tags: string[];
  description: string | null;
}

async function fetchNotionPage(
  notionClient: Client,
  param: QueryDatabaseParameters
): Promise<Array<Task> | undefined> {
  try {
    // Query the database
    const response = await notionClient.databases.query(param);

    // Map over the results to extract the required properties
    const tasks = response.results.map((page) => {
      // Ensure page is of type PageObjectResponse
      if (!('properties' in page)) {
        throw new Error('Invalid page object');
      }

      const properties = (page as PageObjectResponse).properties;

      const status =
        (properties['Status'] as StatusPropertyItemObjectResponse).status
          ?.name || null;
      const task =
        (properties['Task'] as unknown as TitlePropertyItemObjectResponse).title
          ?.plain_text || null;
      const availableOn =
        (properties['Available on'] as DatePropertyItemObjectResponse).date
          ?.start || null;
      const dueDate =
        (properties['Due date'] as DatePropertyItemObjectResponse).date
          ?.start || null;
      const tags =
        (
          properties['Tags'] as MultiSelectPropertyItemObjectResponse
        ).multi_select.map((tag) => tag.name) || [];
      const description =
        (
          properties[
            'Description'
          ] as unknown as RichTextPropertyItemObjectResponse
        ).rich_text?.plain_text || null;

      return {
        status,
        task,
        availableOn,
        dueDate,
        tags,
        description,
      };
    });

    return tasks;
  } catch (error) {
    logger.error(error);
    return undefined;
  }
}

export default fetchNotionPage;
