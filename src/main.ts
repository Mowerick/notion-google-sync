import { Client } from '@notionhq/client';
import logger from 'logger';
import fetchNotionPage from 'notion';
import config from 'config';
import { QueryDatabaseParameters } from '@notionhq/client/build/src/api-endpoints';

async function main() {
  const notionClient = new Client({ auth: config.notion.api.token });
  const databaseParam: QueryDatabaseParameters = {
    filter: {
      property: 'Status',
      status: {
        does_not_equal: 'Archived',
      },
    },
    database_id: config.notion.uniTasksId,
  };
  const uniTasks = await fetchNotionPage(notionClient, databaseParam);
  logger.info(JSON.stringify(uniTasks));
}

main();
