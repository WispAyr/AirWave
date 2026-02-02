const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    // Redact sensitive fields
    const sanitized = redactSensitive(meta);
    const metaStr = Object.keys(sanitized).length ? JSON.stringify(sanitized) : '';
    const stackStr = stack ? `\n${stack}` : '';
    return `${timestamp} [${level.toUpperCase()}]: ${message} ${metaStr}${stackStr}`;
  })
);

// Sensitive field patterns to redact
const SENSITIVE_PATTERNS = [
  /api[_-]?key/i,
  /token/i,
  /secret/i,
  /password/i,
  /authorization/i,
  /bearer/i,
];

function redactSensitive(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  
  const redacted = {};
  for (const [key, value] of Object.entries(obj)) {
    const isSensitive = SENSITIVE_PATTERNS.some(pattern => pattern.test(key));
    if (isSensitive) {
      redacted[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      redacted[key] = redactSensitive(value);
    } else {
      redacted[key] = value;
    }
  }
  return redacted;
}

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  transports: [
    // Console transport for development
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        logFormat
      ),
      silent: process.env.NODE_ENV === 'test',
    }),
    // Daily rotating file for all logs
    new DailyRotateFile({
      filename: path.join(__dirname, '../data/logs/airwave-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d',
      level: 'info',
    }),
    // Separate file for errors
    new DailyRotateFile({
      filename: path.join(__dirname, '../data/logs/error-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '30d',
      level: 'error',
    }),
  ],
  // Handle uncaught exceptions
  exceptionHandlers: [
    new DailyRotateFile({
      filename: path.join(__dirname, '../data/logs/exceptions-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '30d',
    }),
  ],
  // Handle unhandled rejections
  rejectionHandlers: [
    new DailyRotateFile({
      filename: path.join(__dirname, '../data/logs/rejections-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '30d',
    }),
  ],
});

// Create logs directory if it doesn't exist
const fs = require('fs');
const logsDir = path.join(__dirname, '../data/logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

module.exports = logger;

