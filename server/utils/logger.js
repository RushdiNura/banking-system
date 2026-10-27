import winston from 'winston';
import path from 'path';
import fs from 'fs';

// Create logs directory if it doesn't exist
const logDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Create logger instance
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { service: 'banking-api' },
  transports: [
    // Write all logs to console
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    // Write all logs with level 'error' or below to error.log
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    // Write all logs to combined.log
    new winston.transports.File({
      filename: path.join(logDir, 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 10
    })
  ],
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(logDir, 'exceptions.log')
    })
  ],
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(logDir, 'rejections.log')
    })
  ],
  exitOnError: false
});

// Create a stream object for Morgan integration
export const morganStream = {
  write: (message) => {
    logger.info(message.trim());
  }
};

// Helper functions for structured logging
export const logInfo = (message, meta = {}) => {
  logger.info(message, meta);
};

export const logError = (message, error = null, meta = {}) => {
  if (error) {
    meta.error = {
      message: error.message,
      stack: error.stack,
      name: error.name
    };
  }
  logger.error(message, meta);
};

export const logWarning = (message, meta = {}) => {
  logger.warn(message, meta);
};

export const logDebug = (message, meta = {}) => {
  logger.debug(message, meta);
};

// Transaction logging
export const logTransaction = (transactionData) => {
  logger.info('Transaction processed', {
    type: 'transaction',
    ...transactionData,
    timestamp: new Date().toISOString()
  });
};

// Security event logging
export const logSecurityEvent = (eventData) => {
  logger.warn('Security event', {
    type: 'security',
    ...eventData,
    timestamp: new Date().toISOString()
  });
};

// Audit logging
export const logAudit = (auditData) => {
  logger.info('Audit log', {
    type: 'audit',
    ...auditData,
    timestamp: new Date().toISOString()
  });
};