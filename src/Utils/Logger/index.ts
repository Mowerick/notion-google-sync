import winston from "winston";
import fs from "fs";
import config from "config";

const filename = config.logger.filename;
const path = config.logger.path;
const logFilePath =
  (path.endsWith("/") ? path : path + "/") +
  (filename.startsWith("/") ? filename.substring(1) : filename);

if (path) fs.mkdirSync(path, { recursive: true });

fs.writeFileSync(logFilePath, "", "utf-8");
console.log(logFilePath);
const logger: winston.Logger = winston.createLogger({
  level: "info",
  format: winston.format.printf(({ level, message }) => {
    return `${new Date().toISOString()} [${level.toUpperCase()}] ${message}`;
  }),
  transports: [new winston.transports.File({ filename: logFilePath })],
});

export default logger;
