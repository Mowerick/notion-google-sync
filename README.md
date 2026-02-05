# notion-google-sync


A Node.js tool to synchronize Notion tasks with Google Calendar events.
I created this tool to streamline my university workflow by keeping Notion tasks and Google Calendar events in sync. Managing tasks in Notion gives me a clear overview, while syncing them with Google Calendar helps me stay on top of deadlines, exam registrations, lectures, and group projects.

## Dynamic Property Mapping

You can now configure Notion property names dynamically using the JSON file `.notion-google-sync.json` in your project root. This allows you to change Notion database property names without modifying the codebase—just update the JSON file. This file should be added to `.gitignore` and not deployed or committed.

## Features

- Sync Notion tasks to Google Calendar as events
- Map Notion properties to Google Calendar event fields
- One-way or two-way sync options
- Customizable sync intervals
- Error logging and reporting

## Requirements

- Node.js 16+
- Notion integration token
- Google Cloud service account key (`google_service_account.key`)
- `.env` file with required environment variables


## Notion Database Setup

Your Notion database should contain the following fields and types. The property names can be customized using the mapping file:

| Logical Name | Type         | Description                                 |
|--------------|--------------|---------------------------------------------|
| summary      | Title        | The name/title of the task                  |
| status       | Status       | The status of the task (e.g., Not Started, In Progress, Done, Archived) |
| start/end    | Date         | The start and (optionally) end date/time    |
| category     | Select       | The category/class/course for the task      |
| type         | Select       | The type of task (e.g., Registration, Errand, Homework, Deadline)     |
| priority     | Select       | The priority (e.g., High, Medium, Low)      |
| description  | Rich text    | A description of the task                   |
| location     | Rich text    | The location for the event (optional)       |

**Note:**
- Use the mapping JSON file to link these logical names to your actual Notion property names.
- The "Date" property should be a Notion Date property and can include both start and end dates/times.
- The "Status" property should be a Notion Status property with at least the values: Not Started, In Progress, Done, Archived.

## How to Use the Property Mapping

The file `.notion-google-sync.json` in your project root lets you map the logical property names used in the codebase to the actual property names in your Notion database. This makes it easy to adapt the sync to your own Notion schema and keep your mapping private or environment-specific.

**To update the mapping:**

1. Open `.notion-google-sync.json` in your editor.
2. Change the value for any key to match your Notion property name. For example, if your Notion database uses "Course" instead of "Class" for the category, update:

```json
{
    "category": "Course"
}
```

3. Save the file. No other code changes are needed.

**Example mapping file:**

```json
{
    "summary": "Task",
    "description": "Description",
    "start": "Date",
    "end": "Date",
    "location": "Location",
    "status": "Status",
    "type": "Type",
    "category": "Class",
    "priority": "Priority"
}
```

## Installation

```bash
git clone https://github.com/yourusername/notion-google-sync.git
cd notion-google-sync
npm install
```

## Configuration

1. **Notion Integration**:  
    - Create a Notion integration and share your database with it.
    - Save the integration token.

2. **Google Calendar API**:  
    - Create a Google Cloud project and enable the Calendar API.
    - Download the service account key as `google_service_account.key` and place it in the project root.

3. **Environment Variables**:  
    Create a `.env` file in the project root:

    ```
    NOTION_TOKEN=your_notion_token
    GOOGLE_SERVICE_ACCOUNT_KEY=google_service_account.key
    NOTION_DATABASE_ID=your_database_id
    GOOGLE_CALENDAR_ID=your_calendar_id
    ```

4. **Property Mapping File**:
    - Edit `.notion-google-sync.json` in your project root to map logical property names (like `category`, `summary`, etc.) to your Notion database property names. This enables flexible renaming and schema changes without code edits. Make sure this file is listed in `.gitignore`.

## Usage

First, build the project:

```bash
npm run build
```

Then, run the sync tool:

```bash
node main.js
```

## Customization

- Edit files in `src/` to customize property mapping, sync direction, and interval.
- Adjust logging and error handling as needed.

## License

MIT License

## Contributing

Pull requests are welcome! Please open an issue first to discuss changes.

## Acknowledgements

- [Notion API](https://developers.notion.com/)
- [Google Calendar API](https://developers.google.com/calendar)
- Node.js community

