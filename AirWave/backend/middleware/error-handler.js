const logger = require('../utils/logger');

/**
 * Base class for operational errors (expected errors that can be handled gracefully)
 */
class OperationalError extends Error {
  constructor(message, statusCode = 500, details = null) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Validation error (400)
 */
class ValidationError extends OperationalError {
  constructor(message, details = null) {
    super(message, 400, details);
  }
}

/**
 * Not found error (404)
 */
class NotFoundError extends OperationalError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, 404);
  }
}

/**
 * Service unavailable error (503)
 */
class ServiceUnavailableError extends OperationalError {
  constructor(service = 'Service') {
    super(`${service} is not available`, 503);
  }
}

/**
 * Unauthorized error (401)
 */
class UnauthorizedError extends OperationalError {
  constructor(message = 'Unauthorized') {
    super(message, 401);
  }
}

/**
 * Forbidden error (403)
 */
class ForbiddenError extends OperationalError {
  constructor(message = 'Forbidden') {
    super(message, 403);
  }
}

/**
 * Conflict error (409)
 */
class ConflictError extends OperationalError {
  constructor(message, details = null) {
    super(message, 409, details);
  }
}

// Error ID counter for tracking
let errorIdCounter = 0;

/**
 * Generate unique error ID for tracking
 * @returns {string} Error ID
 */
function generateErrorId() {
  errorIdCounter = (errorIdCounter + 1) % 10000;
  return `ERR${String(errorIdCounter).padStart(4, '0')}`;
}

/**
 * Centralized error handling middleware
 * @param {Error} err - Error object
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Function} next - Next middleware
 */
function errorHandler(err, req, res, next) {
  // Generate unique error ID
  const errorId = generateErrorId();
  
  // Determine if error is operational
  const isOperational = err.isOperational || false;
  
  // Determine status code
  const statusCode = err.statusCode || 500;
  
  // Log error with context
  const logContext = {
    errorId,
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('user-agent'),
    isOperational
  };
  
  if (statusCode >= 500) {
    logger.error('Internal server error', logContext);
  } else if (statusCode >= 400) {
    logger.warn('Client error', logContext);
  }
  
  // Build response
  const response = {
    success: false,
    error: err.message || 'Internal server error',
    errorId
  };
  
  // Add details if available
  if (err.details) {
    response.details = err.details;
  }
  
  // Add stack trace in development mode
  if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'dev') {
    response.stack = err.stack;
  }
  
  // Send response
  res.status(statusCode).json(response);
}

/**
 * 404 Not Found handler for unmatched routes
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    error: 'Route not found',
    path: req.path
  });
}

/**
 * Async handler wrapper to catch errors in async route handlers
 * @param {Function} fn - Async route handler
 * @returns {Function} Wrapped handler
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = {
  OperationalError,
  ValidationError,
  NotFoundError,
  ServiceUnavailableError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  errorHandler,
  notFoundHandler,
  asyncHandler,
  generateErrorId
};

