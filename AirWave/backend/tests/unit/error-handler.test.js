const {
  OperationalError,
  ValidationError,
  NotFoundError,
  ServiceUnavailableError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  errorHandler,
  asyncHandler,
} = require('../../middleware/error-handler');

describe('Error Classes', () => {
  describe('OperationalError', () => {
    test('should create error with default status 500', () => {
      const error = new OperationalError('Test error');
      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(500);
      expect(error.isOperational).toBe(true);
      expect(error.details).toBe(null);
    });

    test('should create error with custom status and details', () => {
      const error = new OperationalError('Test error', 400, { field: 'test' });
      expect(error.statusCode).toBe(400);
      expect(error.details).toEqual({ field: 'test' });
    });
  });

  describe('ValidationError', () => {
    test('should create 400 error', () => {
      const error = new ValidationError('Invalid input');
      expect(error.statusCode).toBe(400);
      expect(error.isOperational).toBe(true);
    });

    test('should accept details', () => {
      const details = { field: 'email', message: 'Invalid format' };
      const error = new ValidationError('Invalid input', details);
      expect(error.details).toEqual(details);
    });
  });

  describe('NotFoundError', () => {
    test('should create 404 error with default message', () => {
      const error = new NotFoundError();
      expect(error.statusCode).toBe(404);
      expect(error.message).toBe('Resource not found');
    });

    test('should create 404 error with custom resource', () => {
      const error = new NotFoundError('Aircraft');
      expect(error.message).toBe('Aircraft not found');
    });
  });

  describe('ServiceUnavailableError', () => {
    test('should create 503 error with default message', () => {
      const error = new ServiceUnavailableError();
      expect(error.statusCode).toBe(503);
      expect(error.message).toBe('Service is not available');
    });

    test('should create 503 error with custom service', () => {
      const error = new ServiceUnavailableError('Database');
      expect(error.message).toBe('Database is not available');
    });
  });

  describe('UnauthorizedError', () => {
    test('should create 401 error', () => {
      const error = new UnauthorizedError();
      expect(error.statusCode).toBe(401);
      expect(error.message).toBe('Unauthorized');
    });
  });

  describe('ForbiddenError', () => {
    test('should create 403 error', () => {
      const error = new ForbiddenError();
      expect(error.statusCode).toBe(403);
      expect(error.message).toBe('Forbidden');
    });
  });

  describe('ConflictError', () => {
    test('should create 409 error', () => {
      const error = new ConflictError('Resource already exists');
      expect(error.statusCode).toBe(409);
      expect(error.message).toBe('Resource already exists');
    });
  });
});

describe('errorHandler', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      path: '/test',
      method: 'GET',
      ip: '127.0.0.1',
      get: jest.fn(() => 'test-agent'),
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    next = jest.fn();
  });

  test('should handle operational error with correct status', () => {
    const error = new ValidationError('Invalid input');
    errorHandler(error, req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: 'Invalid input',
        errorId: expect.any(String),
      })
    );
  });

  test('should handle non-operational error with 500 status', () => {
    const error = new Error('Unexpected error');
    errorHandler(error, req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: 'Unexpected error',
      })
    );
  });

  test('should include details when available', () => {
    const error = new ValidationError('Invalid input', { field: 'email' });
    errorHandler(error, req, res, next);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        details: { field: 'email' },
      })
    );
  });

  test('should include stack trace in development mode', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    const error = new Error('Test error');
    errorHandler(error, req, res, next);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        stack: expect.any(String),
      })
    );

    process.env.NODE_ENV = originalEnv;
  });

  test('should not include stack trace in production mode', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    const error = new Error('Test error');
    errorHandler(error, req, res, next);

    const callArg = res.json.mock.calls[0][0];
    expect(callArg).not.toHaveProperty('stack');

    process.env.NODE_ENV = originalEnv;
  });
});

describe('asyncHandler', () => {
  test('should handle successful async function', async () => {
    const handler = asyncHandler(async (req, res) => {
      res.json({ success: true });
    });

    const req = {};
    const res = { json: jest.fn() };
    const next = jest.fn();

    await handler(req, res, next);

    expect(res.json).toHaveBeenCalledWith({ success: true });
    expect(next).not.toHaveBeenCalled();
  });

  test('should catch errors and pass to next', async () => {
    const testError = new Error('Test error');
    const handler = asyncHandler(async () => {
      throw testError;
    });

    const req = {};
    const res = {};
    const next = jest.fn();

    await handler(req, res, next);

    expect(next).toHaveBeenCalledWith(testError);
  });

  test('should handle promise rejections', async () => {
    const handler = asyncHandler(() => Promise.reject(new Error('Rejected')));

    const req = {};
    const res = {};
    const next = jest.fn();

    await handler(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: 'Rejected' }));
  });
});

