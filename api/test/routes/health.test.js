const request = require('supertest');
const express = require('express');
const healthRoutes = require('../../server/routes/health');
const DatabaseManager = require('../../dal/DatabaseManager');
const { logger } = require('@librechat/data-schemas');

// Mock the logger
jest.mock('@librechat/data-schemas', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock DatabaseManager
jest.mock('../../dal/DatabaseManager', () => {
  return jest.fn().mockImplementation(() => ({
    healthMonitor: {
      performHealthCheck: jest.fn(),
      getHealthSummary: jest.fn(),
      isHealthy: jest.fn(),
      checkDatabaseHealth: jest.fn(),
      checkSearchHealth: jest.fn(),
      checkSystemHealth: jest.fn(),
      getDetailedHealthReport: jest.fn(),
    },
  }));
});

describe('Health Routes', () => {
  let app;
  let mockDatabaseManager;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    
    // Mock global.databaseManager
    mockDatabaseManager = new DatabaseManager();
    global.databaseManager = mockDatabaseManager;
    
    app.use('/health', healthRoutes);
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete global.databaseManager;
  });

  describe('GET /health', () => {
    it('should return basic health status', async () => {
      mockDatabaseManager.healthMonitor.isHealthy.mockReturnValue(true);

      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body.status).toBe('healthy');
      expect(response.body.timestamp).toBeDefined();
      expect(response.body.service).toBe('LibreChat API');
    });

    it('should return unhealthy status when system is unhealthy', async () => {
      mockDatabaseManager.healthMonitor.isHealthy.mockReturnValue(false);

      const response = await request(app)
        .get('/health')
        .expect(503);

      expect(response.body.status).toBe('unhealthy');
    });

    it('should handle missing health monitor', async () => {
      global.databaseManager = { healthMonitor: null };

      const response = await request(app)
        .get('/health')
        .expect(503);

      expect(response.body.status).toBe('error');
      expect(response.body.error).toContain('Health monitor not available');
    });
  });

  describe('GET /health/detailed', () => {
    it('should return detailed health information', async () => {
      const mockHealthReport = {
        overall: 'healthy',
        database: 'healthy',
        search: 'healthy',
        system: 'healthy',
        timestamp: new Date().toISOString(),
        lastCheck: new Date(),
        checks: {
          database: { status: 'healthy', duration: 50 },
          search: { status: 'healthy', duration: 30 },
          memory: { status: 'healthy' },
          disk: { status: 'healthy' },
        },
      };

      mockDatabaseManager.healthMonitor.getDetailedHealthReport.mockReturnValue(mockHealthReport);

      const response = await request(app)
        .get('/health/detailed')
        .expect(200);

      expect(response.body.overall).toBe('healthy');
      expect(response.body.database).toBe('healthy');
      expect(response.body.search).toBe('healthy');
      expect(response.body.system).toBe('healthy');
      expect(response.body.timestamp).toBeDefined();
    });

    it('should handle health check errors', async () => {
      mockDatabaseManager.healthMonitor.getDetailedHealthReport.mockImplementation(() => {
        throw new Error('Health check failed');
      });

      const response = await request(app)
        .get('/health/detailed')
        .expect(500);

      expect(response.body.status).toBe('error');
      expect(response.body.error).toContain('Health check failed');
    });
  });

  describe('GET /health/database', () => {
    it('should return database health status', async () => {
      const mockDatabaseHealth = {
        status: 'healthy',
        type: 'postgresql',
        duration: 45,
        metrics: {
          activeConnections: 5,
          totalQueries: 100,
        },
      };

      mockDatabaseManager.healthMonitor.checkDatabaseHealth.mockResolvedValue(mockDatabaseHealth);

      const response = await request(app)
        .get('/health/database')
        .expect(200);

      expect(response.body.status).toBe('healthy');
      expect(response.body.type).toBe('postgresql');
      expect(response.body.metrics).toBeDefined();
    });

    it('should return unhealthy status for database issues', async () => {
      const mockDatabaseHealth = {
        status: 'down',
        message: 'Connection timeout',
        duration: 100,
      };

      mockDatabaseManager.healthMonitor.checkDatabaseHealth.mockResolvedValue(mockDatabaseHealth);

      const response = await request(app)
        .get('/health/database')
        .expect(503);

      expect(response.body.status).toBe('down');
      expect(response.body.message).toBe('Connection timeout');
    });
  });

  describe('GET /health/search', () => {
    it('should return search engine health status', async () => {
      const mockSearchHealth = {
        status: 'healthy',
        type: 'meilisearch',
        duration: 25,
        metrics: {
          version: '1.0.0',
        },
      };

      mockDatabaseManager.healthMonitor.checkSearchHealth.mockResolvedValue(mockSearchHealth);

      const response = await request(app)
        .get('/health/search')
        .expect(200);

      expect(response.body.status).toBe('healthy');
      expect(response.body.type).toBe('meilisearch');
      expect(response.body.duration).toBe(25);
    });

    it('should return disabled status for search when not configured', async () => {
      const mockSearchHealth = {
        status: 'disabled',
        message: 'Search service not configured',
        duration: 5,
      };

      mockDatabaseManager.healthMonitor.checkSearchHealth.mockResolvedValue(mockSearchHealth);

      const response = await request(app)
        .get('/health/search')
        .expect(200);

      expect(response.body.status).toBe('disabled');
      expect(response.body.message).toBe('Search service not configured');
    });
  });

  describe('GET /health/system', () => {
    it('should return system health metrics', async () => {
      const mockSystemHealth = {
        status: 'healthy',
        duration: 15,
        memory: {
          rss: 500,
          heapUsed: 300,
          heapTotal: 400,
          external: 50,
          uptime: 120,
        },
        disk: {
          available: true,
          path: '/app',
        },
      };

      mockDatabaseManager.healthMonitor.checkSystemHealth.mockResolvedValue(mockSystemHealth);

      const response = await request(app)
        .get('/health/system')
        .expect(200);

      expect(response.body.status).toBe('healthy');
      expect(response.body.memory).toBeDefined();
      expect(response.body.memory.rss).toBe(500);
      expect(response.body.disk).toBeDefined();
    });
  });

  describe('GET /health/readiness', () => {
    it('should return ready status when all dependencies are available', async () => {
      const mockHealthReport = {
        overall: 'healthy',
        database: 'healthy',
        search: 'healthy',
        system: 'healthy',
        checks: {
          database: { status: 'healthy' },
          search: { status: 'healthy' },
        },
      };

      mockDatabaseManager.healthMonitor.getDetailedHealthReport.mockReturnValue(mockHealthReport);

      const response = await request(app)
        .get('/health/readiness')
        .expect(200);

      expect(response.body.status).toBe('ready');
      expect(response.body.dependencies.database).toBe('ready');
      expect(response.body.dependencies.search).toBe('ready');
    });

    it('should return not ready status when dependencies are unavailable', async () => {
      const mockHealthReport = {
        overall: 'down',
        database: 'down',
        search: 'healthy',
        system: 'healthy',
        checks: {
          database: { status: 'down' },
          search: { status: 'healthy' },
        },
      };

      mockDatabaseManager.healthMonitor.getDetailedHealthReport.mockReturnValue(mockHealthReport);

      const response = await request(app)
        .get('/health/readiness')
        .expect(503);

      expect(response.body.status).toBe('not-ready');
      expect(response.body.dependencies.database).toBe('not-ready');
      expect(response.body.dependencies.search).toBe('ready');
    });
  });

  describe('GET /health/liveness', () => {
    it('should return alive status when service is responsive', async () => {
      const response = await request(app)
        .get('/health/liveness')
        .expect(200);

      expect(response.body.status).toBe('alive');
      expect(response.body.timestamp).toBeDefined();
      expect(response.body.uptime).toBeDefined();
    });
  });

  describe('GET /health/metrics', () => {
    it('should return performance metrics in Prometheus format', async () => {
      const mockHealthSummary = {
        overall: 'healthy',
        database: 'healthy',
        search: 'healthy',
        system: 'healthy',
      };

      mockDatabaseManager.healthMonitor.getHealthSummary.mockReturnValue(mockHealthSummary);

      const response = await request(app)
        .get('/health/metrics')
        .expect(200);

      expect(response.headers['content-type']).toContain('text/plain');
      expect(response.text).toContain('# HELP librechat_');
      expect(response.text).toContain('# TYPE librechat_');
      expect(response.text).toContain('librechat_health_status');
    });

    it('should handle missing metrics gracefully', async () => {
      mockDatabaseManager.healthMonitor.getHealthSummary.mockReturnValue({
        overall: 'unknown',
        database: 'unknown',
        search: 'unknown',
        system: 'unknown',
      });

      const response = await request(app)
        .get('/health/metrics')
        .expect(200);

      expect(response.text).toContain('# HELP librechat_');
      expect(response.text).toContain('librechat_health_status');
    });
  });

  describe('Error handling', () => {
    it('should handle missing databaseManager gracefully', async () => {
      delete global.databaseManager;

      const response = await request(app)
        .get('/health')
        .expect(503);

      expect(response.body.status).toBe('error');
      expect(response.body.error).toContain('Database manager not available');
    });

    it('should handle health monitor initialization errors', async () => {
      global.databaseManager = { healthMonitor: undefined };

      const response = await request(app)
        .get('/health/detailed')
        .expect(503);

      expect(response.body.status).toBe('error');
      expect(response.body.error).toContain('Health monitor not available');
    });

    it('should handle unexpected errors in health checks', async () => {
      mockDatabaseManager.healthMonitor.checkDatabaseHealth.mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      const response = await request(app)
        .get('/health/database')
        .expect(500);

      expect(response.body.status).toBe('error');
      expect(response.body.error).toContain('Unexpected error');
    });
  });
});
