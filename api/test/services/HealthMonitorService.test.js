const HealthMonitorService = require('../../dal/services/HealthMonitorService');
const DatabaseManager = require('../../dal/DatabaseManager');
const { logger } = require('@librechat/data-schemas');

// Mock the logger to prevent test output
jest.mock('@librechat/data-schemas', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('HealthMonitorService', () => {
  let healthMonitor;
  let mockDatabaseManager;

  beforeEach(() => {
    // Mock DatabaseManager
    mockDatabaseManager = {
      adapter: {
        isConnected: jest.fn(),
        getType: jest.fn(),
        pool: {
          query: jest.fn(),
        },
        getDatabase: jest.fn(),
        getPerformanceMetrics: jest.fn(),
      },
      getSearchService: jest.fn(),
    };

    healthMonitor = new HealthMonitorService(mockDatabaseManager);
    // Stop automatic monitoring for tests
    clearInterval(healthMonitor.monitoringInterval);
  });

  afterEach(() => {
    jest.clearAllMocks();
    if (healthMonitor.monitoringInterval) {
      clearInterval(healthMonitor.monitoringInterval);
    }
  });

  describe('constructor', () => {
    it('should initialize with default configuration', () => {
      expect(healthMonitor.databaseManager).toBe(mockDatabaseManager);
      expect(healthMonitor.healthStatus).toBeDefined();
      expect(healthMonitor.healthStatus.database).toBe('unknown');
      expect(healthMonitor.healthStatus.search).toBe('unknown');
      expect(healthMonitor.healthStatus.system).toBe('unknown');
    });
  });

  describe('checkDatabaseHealth', () => {
    it('should return healthy status when PostgreSQL database is connected', async () => {
      mockDatabaseManager.adapter.isConnected.mockReturnValue(true);
      mockDatabaseManager.adapter.getType.mockReturnValue('postgresql');
      mockDatabaseManager.adapter.pool.query.mockResolvedValue({ rows: [{ '?column?': 1 }] });
      mockDatabaseManager.adapter.getPerformanceMetrics.mockReturnValue({
        activeConnections: 5,
        totalQueries: 100,
        averageQueryTime: 50,
        errors: 0,
        slowQueries: 2,
        poolStats: { idle: 3, active: 5 },
      });

      const result = await healthMonitor.checkDatabaseHealth();

      expect(result.status).toBe('healthy');
      expect(result.type).toBe('postgresql');
      expect(result.metrics).toBeDefined();
      expect(result.metrics.activeConnections).toBe(5);
    });

    it('should return healthy status when MongoDB database is connected', async () => {
      const mockDb = {
        admin: () => ({
          ping: jest.fn().mockResolvedValue({}),
        }),
        serverConfig: { connections: [1, 2, 3] },
      };

      mockDatabaseManager.adapter.isConnected.mockReturnValue(true);
      mockDatabaseManager.adapter.getType.mockReturnValue('mongodb');
      mockDatabaseManager.adapter.getDatabase.mockReturnValue(mockDb);

      const result = await healthMonitor.checkDatabaseHealth();

      expect(result.status).toBe('healthy');
      expect(result.type).toBe('mongodb');
      expect(result.metrics.connections).toBe(3);
    });

    it('should return down status when database is not connected', async () => {
      mockDatabaseManager.adapter.isConnected.mockReturnValue(false);

      const result = await healthMonitor.checkDatabaseHealth();

      expect(result.status).toBe('down');
      expect(result.message).toBe('Database not connected');
    });

    it('should handle database check errors', async () => {
      mockDatabaseManager.adapter.isConnected.mockImplementation(() => {
        throw new Error('Connection error');
      });

      const result = await healthMonitor.checkDatabaseHealth();

      expect(result.status).toBe('error');
      expect(result.message).toBe('Connection error');
    });
  });

  describe('checkSearchHealth', () => {
    it('should return healthy status when search is working', async () => {
      const mockSearchService = {
        getHealth: jest.fn().mockResolvedValue({ status: 'available' }),
      };
      mockDatabaseManager.getSearchService.mockReturnValue(mockSearchService);

      const result = await healthMonitor.checkSearchHealth();

      expect(result.status).toBe('healthy');
      expect(result.type).toBe('meilisearch');
    });

    it('should return disabled status when search is not configured', async () => {
      mockDatabaseManager.getSearchService.mockReturnValue(null);

      const result = await healthMonitor.checkSearchHealth();

      expect(result.status).toBe('disabled');
      expect(result.message).toBe('Search service not configured');
    });

    it('should handle search service errors', async () => {
      mockDatabaseManager.getSearchService.mockImplementation(() => {
        throw new Error('Search service error');
      });

      const result = await healthMonitor.checkSearchHealth();

      expect(result.status).toBe('error');
      expect(result.message).toBe('Search service error');
    });
  });

  describe('checkSystemHealth', () => {
    it('should return system health metrics', async () => {
      const result = await healthMonitor.checkSystemHealth();

      expect(result.status).toBeDefined();
      expect(result.memory).toBeDefined();
      expect(result.memory.rss).toBeDefined();
      expect(result.memory.heapUsed).toBeDefined();
      expect(result.memory.heapTotal).toBeDefined();
      expect(result.memory.uptime).toBeDefined();
      expect(result.disk).toBeDefined();
    });

    it('should mark system as warning when memory usage is high', async () => {
      // Mock high memory usage
      const originalMemoryUsage = process.memoryUsage;
      process.memoryUsage = jest.fn().mockReturnValue({
        rss: 1024 * 1024 * 1024 * 2, // 2GB
        heapTotal: 1024 * 1024 * 1024 * 2, // 2GB
        heapUsed: 1024 * 1024 * 1024 * 1.5, // 1.5GB (>1GB threshold)
        external: 0,
        arrayBuffers: 0,
      });

      const result = await healthMonitor.checkSystemHealth();

      expect(result.status).toBe('warning');

      process.memoryUsage = originalMemoryUsage;
    });
  });

  describe('performHealthCheck', () => {
    it('should perform comprehensive health check', async () => {
      mockDatabaseManager.adapter.isConnected.mockReturnValue(true);
      mockDatabaseManager.adapter.getType.mockReturnValue('postgresql');
      mockDatabaseManager.adapter.pool.query.mockResolvedValue({ rows: [{ '?column?': 1 }] });
      mockDatabaseManager.adapter.getPerformanceMetrics.mockReturnValue({
        activeConnections: 5,
        totalQueries: 100,
        averageQueryTime: 50,
        errors: 0,
        slowQueries: 2,
        poolStats: { idle: 3, active: 5 },
      });
      mockDatabaseManager.getSearchService.mockReturnValue(null);

      await healthMonitor.performHealthCheck();

      expect(healthMonitor.healthStatus.database).toBe('healthy');
      expect(healthMonitor.healthStatus.search).toBe('disabled');
      expect(healthMonitor.healthStatus.system).toBeDefined();
      expect(healthMonitor.healthStatus.lastCheck).toBeDefined();
    });
  });

  describe('getHealthSummary', () => {
    it('should return current health summary', () => {
      healthMonitor.healthStatus = {
        database: 'healthy',
        search: 'healthy',
        system: 'healthy',
        lastCheck: new Date(),
        duration: 50,
      };

      const summary = healthMonitor.getHealthSummary();

      expect(summary.overall).toBe('healthy');
      expect(summary.database).toBe('healthy');
      expect(summary.search).toBe('healthy');
      expect(summary.system).toBe('healthy');
    });
  });

  describe('isHealthy', () => {
    it('should return true when system is healthy', () => {
      healthMonitor.healthStatus = {
        database: 'healthy',
        search: 'healthy',
        system: 'healthy',
      };

      expect(healthMonitor.isHealthy()).toBe(true);
    });

    it('should return true when system is degraded but functional', () => {
      healthMonitor.healthStatus = {
        database: 'healthy',
        search: 'disabled',
        system: 'warning',
      };

      expect(healthMonitor.isHealthy()).toBe(true);
    });

    it('should return false when database is down', () => {
      healthMonitor.healthStatus = {
        database: 'down',
        search: 'healthy',
        system: 'healthy',
      };

      expect(healthMonitor.isHealthy()).toBe(false);
    });

    it('should return false when system has errors', () => {
      healthMonitor.healthStatus = {
        database: 'error',
        search: 'healthy',
        system: 'healthy',
      };

      expect(healthMonitor.isHealthy()).toBe(false);
    });
  });

  describe('getOverallHealth', () => {
    it('should return healthy when all components are healthy', () => {
      healthMonitor.healthStatus = {
        database: 'healthy',
        search: 'healthy',
        system: 'healthy',
      };

      expect(healthMonitor.getOverallHealth()).toBe('healthy');
    });

    it('should return degraded when some components have warnings', () => {
      healthMonitor.healthStatus = {
        database: 'healthy',
        search: 'disabled',
        system: 'warning',
      };

      expect(healthMonitor.getOverallHealth()).toBe('degraded');
    });

    it('should return down when database is down', () => {
      healthMonitor.healthStatus = {
        database: 'down',
        search: 'healthy',
        system: 'healthy',
      };

      expect(healthMonitor.getOverallHealth()).toBe('down');
    });

    it('should return unhealthy when there are errors', () => {
      healthMonitor.healthStatus = {
        database: 'error',
        search: 'healthy',
        system: 'healthy',
      };

      expect(healthMonitor.getOverallHealth()).toBe('unhealthy');
    });
  });

  describe('getDetailedHealthReport', () => {
    it('should return detailed health report', () => {
      healthMonitor.healthStatus = {
        database: 'healthy',
        search: 'healthy',
        system: 'healthy',
        lastCheck: new Date(),
        checks: {
          database: { status: 'healthy' },
          search: { status: 'healthy' },
          memory: { status: 'healthy' },
          disk: { status: 'healthy' },
        },
      };

      const report = healthMonitor.getDetailedHealthReport();

      expect(report.database).toBe('healthy');
      expect(report.overall).toBe('healthy');
      expect(report.timestamp).toBeDefined();
      expect(report.environment).toBeDefined();
    });
  });
});
