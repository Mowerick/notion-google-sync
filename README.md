# notion-google-sync

A Node.js tool to synchronize Notion tasks with Google Calendar events.
I created this tool to streamline my university workflow by keeping Notion tasks and Google Calendar events in sync. Managing tasks in Notion gives me a clear overview, while syncing them with Google Calendar helps me stay on top of deadlines, exam registrations, lectures, and group projects.

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

Your Notion database must contain the following fields with these exact names and types for the sync to work:

| Field Name   | Type         | Description                                 |
|--------------|--------------|---------------------------------------------|
| Task         | Title        | The name/title of the task                  |
| Status       | Status       | The status of the task (e.g., Not Started, In Progress, Done, Archived) |
| Date         | Date         | The start and (optionally) end date/time    |
| Class        | Select       | The class or category for the task          |
| Type         | Select       | The type of task (e.g., Homework, Exam)     |
| Priority     | Select       | The priority (e.g., High, Medium, Low)      |
| Description  | Rich text    | A description of the task                   |
| Location     | Rich text    | The location for the event (optional)       |

**Note:**  
- Field names must match exactly (case-sensitive).
- The "Date" property should be a Notion Date property and can include both start and end dates/times.
- The "Status" property should be a Notion Status property with at least the values: Not Started, In Progress, Done, Archived.

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

4. **Configuration File**:  
    - Edit `src/config.js` to map Notion properties to Google Calendar event fields and adjust sync options.

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

