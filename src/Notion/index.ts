import { Client } from '@notionhq/client';
import {
  DatePropertyItemObjectResponse,
  MultiSelectPropertyItemObjectResponse,
  QueryDatabaseParameters,
  RichTextItemResponse,
  StatusPropertyItemObjectResponse,
} from '@notionhq/client/build/src/api-endpoints';

import logger from 'logger';

interface Task {
  id: string;
  status: string;
  task: string;
  availableOnStart: string;
  availableOnEnd: string;
  dueDateStart: string;
  dueDateEnd: string;
  tags: string[];
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
        logger.error('Invalid page object');
        throw Error('Invalid page object');
      }

      const properties = page.properties;

      const status =
        (properties['Status'] as StatusPropertyItemObjectResponse).status
          ?.name || '';
      const task =
        (properties['Task'] as TitleObjectResponse).title[0]?.plain_text || '';
      const availableOnStart =
        (properties['Available on'] as DatePropertyItemObjectResponse).date
          ?.start || '';
      const availableOnEnd =
        (properties['Available on'] as DatePropertyItemObjectResponse).date
          ?.end || '';
      const dueDateStart =
        (properties['Due date'] as DatePropertyItemObjectResponse).date
          ?.start || '';
      const dueDateEnd =
        (properties['Due date'] as DatePropertyItemObjectResponse).date?.end ||
        '';
      const tags =
        (
          properties['Tags'] as MultiSelectPropertyItemObjectResponse
        ).multi_select
          .map((tag) => tag.name)
          .sort() || [];
      // Extract description (rich text is also an array)
      const description =
        (properties['Description'] as unknown as RichTextObjectRespone)
          .rich_text[0]?.plain_text || '';

      // Extract location (rich text is also an array)
      const location =
        (properties['Location'] as unknown as RichTextObjectRespone)
          .rich_text[0]?.plain_text || '';

      return {
        id: page.id?.split('-').join('') || '',
        status,
        task,
        availableOnStart,
        availableOnEnd,
        dueDateStart,
        dueDateEnd,
        tags,
        description,
        location,
      };
    });

    return tasks;
  } catch (error) {
    logger.error(error);
    return undefined;
  }
}

export default fetchNotionPage;
