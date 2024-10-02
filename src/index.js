import dotenv from "dotenv";
import { Client } from "@notionhq/client";
import fetchNotionPage from './Notion/index.js'
dotenv.config();
const NOTION_CLIENT = new Client({ auth: process.env.NOTION_TOKEN });
const UNI_TASKS_FILTER = {
  property: "Status",
  status: {
    does_not_equal: "Archived",
  },
};

const UNI_TASKS_ID = process.env.UNI_TASKS_ID;
const uniTasks = await fetchNotionPage(NOTION_CLIENT, UNI_TASKS_ID, UNI_TASKS_FILTER);
console.log(uniTasks);
