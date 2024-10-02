
const fetchNotionPage = async (NOTION_CLIENT, DATABASE_ID, FILTER) => {
  try {
    // Query the database
    const response = await NOTION_CLIENT.databases.query({
      database_id: DATABASE_ID,
      filter: FILTER,
    });

    // Map over the results to extract the required properties
    const tasks = response.results.map((page) => {
      const properties = page.properties;

      const status =
        properties['Status'].status?.name || null;
      const task =
        properties['Task'].title[0]?.plain_text || null;
      const availableOn =
        properties['Available on'].date?.start || null;
      const dueDate =
        properties['Due date'].date?.start || null;
      const tags =
        properties['Tags'].multi_select.map((tag) => tag.name) || [];
      const description =
        properties['Description'].rich_text[0]?.plain_text || null;

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
    console.error(error);
  }
};

export default fetchNotionPage;

