import winston from "winston";
import fs from 'fs';

const LOG_FILE_PATH = './script.log';

fs.writeFileSync(LOG_FILE_PATH, '', 'utf-8');

const logger: winston.Logger = winston.createLogger({
  level: 'info',
  format: winston.format.printf(({ level, message }) => {
    return `${new Date().toISOString()} [${level.toUpperCase()}] ${message}`;
  }),
  transports: [
    new winston.transports.File({ filename: LOG_FILE_PATH })
  ],
});

export default logger;