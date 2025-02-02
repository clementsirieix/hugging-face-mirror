import path from "path";
import winston, { format } from "winston";
import { env } from "./env";

export const logger = winston.createLogger({
    format: format.combine(
        format.timestamp({
            format: "YYYY-MM-DD HH:mm:ss",
        }),
        format.errors({ stack: true }),
        format.splat(),
        format.json()
    ),
    transports: [
        ...(env.shouldLog
            ? [
                  new winston.transports.File({
                      filename: path.join(process.cwd(), "logs", "combined.log"),
                      maxsize: 524288000,
                      maxFiles: 5,
                  }),
                  new winston.transports.File({
                      filename: path.join(process.cwd(), "logs", "error.log"),
                      level: "error",
                      maxsize: 524288000,
                      maxFiles: 5,
                  }),
              ]
            : []),
        new winston.transports.Console({
            format: format.combine(format.colorize(), format.simple()),
        }),
    ],
});
