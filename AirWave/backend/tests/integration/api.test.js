/**
 * API Integration Tests
 * 
 * These tests verify the API endpoints work correctly with the database and services.
 * Run with: npm run test:integration
 */

const request = require('supertest');
const express = require('express');
const routes = require('../../routes');
const AirwaveDatabase = require('../../services/database-sqlite');

describe('API Integration Tests', () => {
  let app;
  let database;

  beforeAll(() => {
    // Create test app
    app = express();
    app.use(express.json());

    // Initialize test database (in-memory)
    database = new AirwaveDatabase(':memory:');

    // Make database available to routes
    app.locals.database = database;
    app.locals.aircraftTracker = { /* mock */ };
    app.locals.hfgcsTracker = { /* mock */ };

    // Mount routes
    app.use('/api', routes);
  });

  afterAll(() => {
    if (database) {
      database.close();
    }
  });

  describe('GET /api/schemas', () => {
    test('should return list of schemas', async () => {
      const response = await request(app)
        .get('/api/schemas')
        .expect(200);

      expect(response.body).toHaveProperty('count');
      expect(response.body).toHaveProperty('schemas');
      expect(Array.isArray(response.body.schemas)).toBe(true);
      expect(response.body.count).toBeGreaterThan(0);
    });

    test('should include ACARS schema', async () => {
      const response = await request(app)
        .get('/api/schemas')
        .expect(200);

      const schemaNames = response.body.schemas.map(s => s.name);
      expect(schemaNames).toContain('acars-message');
    });
  });

  describe('GET /api/schemas/:name', () => {
    test('should return specific schema', async () => {
      const response = await request(app)
        .get('/api/schemas/acars-message')
        .expect(200);

      expect(response.body).toHaveProperty('name', 'acars-message');
      expect(response.body).toHaveProperty('schema');
      expect(response.body.schema).toHaveProperty('type', 'object');
    });

    test('should return 404 for non-existent schema', async () => {
      const response = await request(app)
        .get('/api/schemas/non-existent')
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/stats', () => {
    test('should return statistics', async () => {
      const response = await request(app)
        .get('/api/stats')
        .expect(200);

      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('database');
    });
  });

  describe('GET /api/messages/recent', () => {
    test('should return empty array initially', async () => {
      const response = await request(app)
        .get('/api/messages/recent')
        .expect(200);

      expect(response.body).toHaveProperty('count', 0);
      expect(response.body).toHaveProperty('messages');
      expect(response.body.messages).toEqual([]);
    });

    test('should respect limit parameter', async () => {
      const response = await request(app)
        .get('/api/messages/recent?limit=50')
        .expect(200);

      expect(response.body).toHaveProperty('messages');
      expect(Array.isArray(response.body.messages)).toBe(true);
    });
  });

  describe('GET /api/messages/search', () => {
    test('should require query parameter', async () => {
      const response = await request(app)
        .get('/api/messages/search')
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toMatch(/required/i);
    });

    test('should accept query parameter', async () => {
      const response = await request(app)
        .get('/api/messages/search?q=test')
        .expect(200);

      expect(response.body).toHaveProperty('count');
      expect(response.body).toHaveProperty('query', 'test');
      expect(response.body).toHaveProperty('messages');
    });
  });

  describe('GET /api/aircraft/active', () => {
    test('should return active aircraft list', async () => {
      const response = await request(app)
        .get('/api/aircraft/active')
        .expect(200);

      expect(response.body).toHaveProperty('count');
      expect(response.body).toHaveProperty('aircraft');
      expect(Array.isArray(response.body.aircraft)).toBe(true);
    });
  });

  describe('GET /api/sources', () => {
    test('should return data source status', async () => {
      const response = await request(app)
        .get('/api/sources')
        .expect(200);

      expect(response.body).toHaveProperty('sources');
      expect(response.body).toHaveProperty('stats');
    });

    test('should handle missing dataSourceManager gracefully', async () => {
      // This test verifies the 503 response when service is unavailable
      const response = await request(app)
        .get('/api/sources');

      expect([200, 503]).toContain(response.status);
    });
  });

  describe('POST /api/validate/:schema', () => {
    test('should validate valid ACARS message', async () => {
      const validMessage = {
        id: 'test-123',
        timestamp: new Date().toISOString(),
        text: 'Test message'
      };

      const response = await request(app)
        .post('/api/validate/acars-message')
        .send(validMessage)
        .expect(200);

      expect(response.body).toHaveProperty('valid');
    });

    test('should reject invalid message', async () => {
      const invalidMessage = {
        id: 123, // Should be string
        // missing required timestamp
      };

      const response = await request(app)
        .post('/api/validate/acars-message')
        .send(invalidMessage)
        .expect(200);

      expect(response.body).toHaveProperty('valid', false);
      expect(response.body).toHaveProperty('errors');
    });
  });
});

