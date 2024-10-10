import { Client } from '@notionhq/client';
import {
  DatePropertyItemObjectResponse,
  QueryDatabaseParameters,
  RichTextItemResponse,
  SelectPropertyItemObjectResponse,
  StatusPropertyItemObjectResponse,
} from '@notionhq/client/build/src/api-endpoints';

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

async function fetchNotionPage(
  notionClient: Client,
  param: QueryDatabaseParameters
): Promise<Array<Task> | undefined> {
  try {
    const response = await notionClient.databases.query(param);

    const tasks = await Promise.all(
      response.results.map(async (page) => {
        if (!('properties' in page)) {
          await logger.error('Invalid page object');
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
    await logger.info(logMsg);
    return tasks;
  } catch (error) {
    await logger.error(error);
    return undefined;
  }
}

export default fetchNotionPage;
