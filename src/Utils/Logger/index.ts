import fs from 'fs';
import winston from 'winston';

import config from 'config';

const filename = config.logger.filename;
const path = config.logger.path;
const logFilePath =
  (path.endsWith('/') ? path : path + '/') +
  (filename.startsWith('/') ? filename.substring(1) : filename);

if (path) fs.mkdirSync(path, { recursive: true });

fs.writeFileSync(logFilePath, '', 'utf-8');

const now = new Date();
const logFile = new winston.transports.File({ filename: logFilePath });
const logger: winston.Logger = winston.createLogger({
  level: 'info',
  format: winston.format.printf(({ level, message }) => {
    return `${now.toLocaleDateString()} ${now.toLocaleTimeString()} [${level.toUpperCase()}] ${message}`;
  }),
  transports: [logFile],
});

export default logger;
