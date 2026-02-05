// Maps Google Calendar event property names to Notion property names
// Update the Notion property names as needed to match your Notion database
const NOTION_GOOGLE_PROPERTY_MAP = {
  summary: 'Task', // Google 'summary' <-> Notion 'Task' (title)
  description: 'Description', // Google 'description' <-> Notion 'Description'
  start: 'Date', // Google 'start' <-> Notion 'Date' (start)
  end: 'Date', // Google 'end' <-> Notion 'Date' (end)
  location: 'Location', // Google 'location' <-> Notion 'Location'
  status: 'Status', // Notion status property
  type: 'Type', // Notion type property
  category: 'Class', // Notion class/category property (was className)
  priority: 'Priority', // Notion priority property
};

export default NOTION_GOOGLE_PROPERTY_MAP;
