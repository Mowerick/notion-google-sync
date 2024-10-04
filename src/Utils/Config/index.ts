import dotenv from 'dotenv';
dotenv.config();

interface Config {
  google: {
    api: {
      clientId: string;
      clientSecret: string;
      redirectUri: string;
    };
  };
  notion: {
    uniTasksId: string;
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
      redirectUri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost',
    },
  },
  notion: {
    uniTasksId: process.env.UNI_TASKS_ID || '',
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
