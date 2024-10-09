import dotenv from 'dotenv';
import fs from 'fs';

import { ServiceAccountKey } from 'google';
dotenv.config();

interface Config {
  google: {
    api: {
      clientId: string;
      clientSecret: string;
      redirectUri: string;
      serviceAccountKey: ServiceAccountKey | undefined;
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
      serviceAccountKey:
        JSON.parse(
          fs.readFileSync(String(process.env.GOOGLE_SERVICE_KEY_FILE), 'utf-8')
        ) || {},
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
