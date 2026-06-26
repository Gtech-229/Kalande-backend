import winston from "winston";
import { env } from "../config/env";

const isProduction = env.NODE_ENV === "production";

/**
 * Application logger (Winston).
 *
 * Development: colorized, human-readable lines at "debug" level.
 * Production:  structured JSON at "info" level (easy for log collectors).
 *
 * Always log through this instead of console.log (CLAUDE.md).
 */
const developmentFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: "HH:mm:ss" }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const extra = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : "";
    return `${timestamp} ${level}: ${message}${extra}`;
  })
);

const productionFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.json()
);

const logger = winston.createLogger({
  level: isProduction ? "info" : "debug",
  format: isProduction ? productionFormat : developmentFormat,
  transports: [new winston.transports.Console()],
});

export default logger;
