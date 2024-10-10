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
    sequelizeLogging: boolean;
  };
  mailer: {
    from: string;
    to: string;
    subject: string;
    service: string;
    auth: {
      user: string;
      password: string;
    };
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
    sequelizeLogging:
      parseBoolean(process.env.LOG_SEQUELIZE_ENABLED || '') || false,
  },
  mailer: {
    service: process.env.MAIL_SERVICE || 'gmail',
    from: process.env.MAIL_FROM || process.env.MAIL_USER || '',
    to: process.env.MAIL_TO || process.env.MAIL_USER || '',
    subject: process.env.MAIL_SUBJECT || 'Report Notion-google-sync',
    auth: {
      user: process.env.MAIL_USER || '',
      password: process.env.MAIL_PASSWORD || '',
    },
  },
};

function parseBoolean(str: string): boolean {
  return str.toLowerCase() === 'true' || str.toLowerCase() == '1';
}

export default config;
