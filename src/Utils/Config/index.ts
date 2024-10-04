import dotenv from 'dotenv';
dotenv.config();

interface Config {
  google: {
    api: {
      clientId: string;
      clientSecret: string;
      redirectUri: string;
      serviceAccountKey: string;
    };
    calendarId: string;
  };
  notion: {
    pageId: string;
    api: {
      token: string;
    };
  };
  logger: {
    path: string;
    filename: string;
  };
}

const config: Config = {
  google: {
    api: {
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      redirectUri: process.env.GOOGLE_REDIRECT_URI || '',
      serviceAccountKey: process.env.GOOGLE_SERVICE_KEY_FILE || '',
    },
    calendarId: process.env.GOOGLE_CALENDAR_ID || '',
  },
  notion: {
    pageId: process.env.PAGE_ID || '',
    api: {
      token: process.env.NOTION_TOKEN || '',
    },
  },
  logger: {
    path: process.env.LOG_PATH || '',
    filename: process.env.LOG_FILENAME || 'script.log',
  },
};

export default config;
