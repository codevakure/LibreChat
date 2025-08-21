const PostgresAdapter = require('../../dal/adapters/PostgresAdapter');
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

// Mock pg module
const mockPool = {
  connect: jest.fn(),
  query: jest.fn(),
  end: jest.fn(),
  totalCount: 10,
  idleCount: 5,
  waitingCount: 0,
};

const mockClient = {
  query: jest.fn(),
  release: jest.fn(),
};

jest.mock('pg', () => ({
  Pool: jest.fn(() => mockPool),
}));

describe('PostgresAdapter Performance Features', () => {
  let adapter;
  const mockConfig = {
    host: 'localhost',
    port: 5432,
    database: 'test_db',
    user: 'test_user',
    password: 'test_password',
    ssl: false,
    performance: {
      enableMetrics: true,
      slowQueryThreshold: 100,
      connectionTimeout: 5000,
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    adapter = new PostgresAdapter(mockConfig);
  });

  afterEach(() => {
    if (adapter.performanceInterval) {
      clearInterval(adapter.performanceInterval);
    }
  });

  describe('Performance Monitoring', () => {
    it('should initialize performance monitoring on connect', async () => {
      mockPool.connect.mockResolvedValue(mockClient);
      mockClient.query.mockResolvedValue({ rows: [{ version: 'PostgreSQL 14.0' }] });
      
      jest.spyOn(adapter, 'startPerformanceMonitoring');
      
      await adapter.connect();
      
      expect(adapter.startPerformanceMonitoring).toHaveBeenCalled();
    });

    it('should start performance monitoring interval', () => {
      jest.spyOn(global, 'setInterval');
      
      adapter.startPerformanceMonitoring();
      
      expect(setInterval).toHaveBeenCalledWith(
        expect.any(Function),
        adapter.config.performance.monitoringInterval || 30000
      );
      expect(adapter.performanceInterval).toBeDefined();
    });

    it('should stop performance monitoring on disconnect', async () => {
      adapter.performanceInterval = 123;
      jest.spyOn(global, 'clearInterval');
      
      await adapter.disconnect();
      
      expect(clearInterval).toHaveBeenCalledWith(123);
      expect(adapter.performanceInterval).toBe(null);
    });

    it('should collect connection metrics', () => {
      mockPool.totalCount = 20;
      mockPool.idleCount = 15;
      mockPool.waitingCount = 2;
      
      const metrics = adapter.getConnectionMetrics();
      
      expect(metrics.activeConnections).toBe(5); // totalCount - idleCount
      expect(metrics.totalConnections).toBe(20);
      expect(metrics.idleConnections).toBe(15);
      expect(metrics.waitingConnections).toBe(2);
      expect(metrics.queriesExecuted).toBeDefined();
      expect(metrics.averageQueryTime).toBeDefined();
    });

    it('should track query performance', async () => {
      const mockResult = { rows: [{ id: 1 }], rowCount: 1 };
      mockPool.query.mockResolvedValue(mockResult);
      
      const startTime = Date.now();
      const result = await adapter.executeQuery('SELECT * FROM users WHERE id = $1', [1]);
      const endTime = Date.now();
      
      expect(result).toBe(mockResult);
      expect(adapter.queryMetrics.totalQueries).toBe(1);
      expect(adapter.queryMetrics.totalTime).toBeGreaterThan(0);
      expect(adapter.queryMetrics.totalTime).toBeLessThan(endTime - startTime + 50); // Allow some margin
    });

    it('should track slow queries', async () => {
      // Mock a slow query
      const mockResult = { rows: [], rowCount: 0 };
      mockPool.query.mockImplementation(() => {
        return new Promise(resolve => {
          setTimeout(() => resolve(mockResult), 150); // Slower than threshold
        });
      });
      
      const query = 'SELECT * FROM large_table WHERE complex_condition = $1';
      await adapter.executeQuery(query, ['value']);
      
      expect(adapter.slowQueries.length).toBe(1);
      expect(adapter.slowQueries[0].query).toBe(query);
      expect(adapter.slowQueries[0].duration).toBeGreaterThan(100);
    });

    it('should limit slow queries history', async () => {
      adapter.slowQueries = new Array(15).fill({ query: 'old query', duration: 200 });
      
      const mockResult = { rows: [], rowCount: 0 };
      mockPool.query.mockImplementation(() => {
        return new Promise(resolve => {
          setTimeout(() => resolve(mockResult), 150);
        });
      });
      
      await adapter.executeQuery('SELECT * FROM test', []);
      
      expect(adapter.slowQueries.length).toBe(10); // Should be limited to 10
      expect(adapter.slowQueries[9].query).toBe('SELECT * FROM test');
    });
  });

  describe('Connection Pool Optimization', () => {
    it('should configure connection pool with performance settings', async () => {
      const { Pool } = require('pg');
      
      await adapter.connect();
      
      expect(Pool).toHaveBeenCalledWith(expect.objectContaining({
        host: mockConfig.host,
        port: mockConfig.port,
        database: mockConfig.database,
        user: mockConfig.user,
        password: mockConfig.password,
        ssl: mockConfig.ssl,
        max: expect.any(Number),
        min: expect.any(Number),
        idleTimeoutMillis: expect.any(Number),
        connectionTimeoutMillis: expect.any(Number),
      }));
    });

    it('should handle connection pool errors', async () => {
      mockPool.connect.mockRejectedValue(new Error('Connection pool exhausted'));
      
      await expect(adapter.connect()).rejects.toThrow('Connection pool exhausted');
      expect(logger.error).toHaveBeenCalledWith(
        'PostgreSQL connection failed:',
        expect.any(Error)
      );
    });

    it('should retry connection with exponential backoff', async () => {
      let attempts = 0;
      mockPool.connect.mockImplementation(() => {
        attempts++;
        if (attempts < 3) {
          return Promise.reject(new Error('Connection failed'));
        }
        return Promise.resolve(mockClient);
      });
      
      mockClient.query.mockResolvedValue({ rows: [{ version: 'PostgreSQL 14.0' }] });
      
      const startTime = Date.now();
      await adapter.connect();
      const endTime = Date.now();
      
      expect(attempts).toBe(3);
      expect(endTime - startTime).toBeGreaterThan(100); // Should have some delay
    });
  });

  describe('Prepared Statements', () => {
    it('should cache prepared statements', async () => {
      const mockResult = { rows: [{ id: 1 }] };
      mockPool.query.mockResolvedValue(mockResult);
      
      const query = 'SELECT * FROM users WHERE id = $1';
      
      // First execution
      await adapter.executeQuery(query, [1]);
      expect(adapter.preparedStatements.has(query)).toBe(true);
      
      // Second execution should use cached statement
      await adapter.executeQuery(query, [2]);
      expect(mockPool.query).toHaveBeenCalledTimes(2);
    });

    it('should limit prepared statements cache size', async () => {
      const mockResult = { rows: [] };
      mockPool.query.mockResolvedValue(mockResult);
      
      // Create more statements than the limit
      for (let i = 0; i < 105; i++) {
        await adapter.executeQuery(`SELECT * FROM table${i} WHERE id = $1`, [1]);
      }
      
      expect(adapter.preparedStatements.size).toBeLessThanOrEqual(100);
    });

    it('should handle prepared statement errors', async () => {
      mockPool.query.mockRejectedValue(new Error('Invalid prepared statement'));
      
      await expect(
        adapter.executeQuery('INVALID QUERY', [])
      ).rejects.toThrow('Invalid prepared statement');
    });
  });

  describe('Query Optimization', () => {
    beforeEach(() => {
      mockPool.connect.mockResolvedValue(mockClient);
      mockClient.query.mockResolvedValue({ rows: [{ version: 'PostgreSQL 14.0' }] });
    });

    it('should execute queries with performance tracking', async () => {
      await adapter.connect();
      
      const mockResult = { rows: [{ id: 1, name: 'test' }], rowCount: 1 };
      mockPool.query.mockResolvedValue(mockResult);
      
      const result = await adapter.executeQuery(
        'SELECT id, name FROM users WHERE active = $1',
        [true]
      );
      
      expect(result).toBe(mockResult);
      expect(adapter.queryMetrics.totalQueries).toBe(1);
      expect(mockPool.query).toHaveBeenCalledWith(
        'SELECT id, name FROM users WHERE active = $1',
        [true]
      );
    });

    it('should handle query timeout', async () => {
      await adapter.connect();
      
      // Mock a query that takes too long
      mockPool.query.mockImplementation(() => {
        return new Promise((resolve) => {
          setTimeout(() => resolve({ rows: [] }), 6000); // Longer than timeout
        });
      });
      
      await expect(
        adapter.executeQuery('SELECT * FROM slow_table', [])
      ).rejects.toThrow();
    });

    it('should batch queries for better performance', async () => {
      await adapter.connect();
      
      const queries = [
        { text: 'INSERT INTO users (name) VALUES ($1)', values: ['user1'] },
        { text: 'INSERT INTO users (name) VALUES ($1)', values: ['user2'] },
        { text: 'INSERT INTO users (name) VALUES ($1)', values: ['user3'] },
      ];
      
      const mockResults = [
        { rows: [], rowCount: 1 },
        { rows: [], rowCount: 1 },
        { rows: [], rowCount: 1 },
      ];
      
      mockPool.query.mockImplementation((query) => {
        const index = queries.findIndex(q => q.text === query);
        return Promise.resolve(mockResults[index]);
      });
      
      const results = await Promise.all(
        queries.map(q => adapter.executeQuery(q.text, q.values))
      );
      
      expect(results).toHaveLength(3);
      expect(adapter.queryMetrics.totalQueries).toBe(3);
    });
  });

  describe('Health Monitoring Integration', () => {
    it('should provide health status', () => {
      adapter.connected = true;
      adapter.pool = mockPool;
      
      const health = adapter.getHealthStatus();
      
      expect(health.connected).toBe(true);
      expect(health.connectionPool).toBeDefined();
      expect(health.connectionPool.total).toBe(10);
      expect(health.connectionPool.idle).toBe(5);
      expect(health.connectionPool.active).toBe(5);
    });

    it('should report unhealthy status when disconnected', () => {
      adapter.connected = false;
      adapter.pool = null;
      
      const health = adapter.getHealthStatus();
      
      expect(health.connected).toBe(false);
      expect(health.error).toBeDefined();
    });

    it('should include performance metrics in health status', () => {
      adapter.connected = true;
      adapter.pool = mockPool;
      adapter.queryMetrics = {
        totalQueries: 100,
        totalTime: 5000,
        slowQueries: 2,
      };
      
      const health = adapter.getHealthStatus();
      
      expect(health.performance.totalQueries).toBe(100);
      expect(health.performance.averageQueryTime).toBe(50);
      expect(health.performance.slowQueries).toBe(2);
    });
  });

  describe('Memory Management', () => {
    it('should clean up resources on disconnect', async () => {
      adapter.connected = true;
      adapter.pool = mockPool;
      adapter.preparedStatements = new Map([['query1', 'statement1']]);
      adapter.slowQueries = [{ query: 'slow', duration: 200 }];
      adapter.performanceInterval = 123;
      
      jest.spyOn(global, 'clearInterval');
      
      await adapter.disconnect();
      
      expect(mockPool.end).toHaveBeenCalled();
      expect(adapter.preparedStatements.size).toBe(0);
      expect(adapter.slowQueries).toHaveLength(0);
      expect(clearInterval).toHaveBeenCalledWith(123);
      expect(adapter.connected).toBe(false);
      expect(adapter.pool).toBe(null);
    });

    it('should handle memory pressure by clearing caches', () => {
      // Fill up prepared statements cache
      for (let i = 0; i < 150; i++) {
        adapter.preparedStatements.set(`query${i}`, `statement${i}`);
      }
      
      // Fill up slow queries
      for (let i = 0; i < 20; i++) {
        adapter.slowQueries.push({ query: `slow${i}`, duration: 200 });
      }
      
      adapter.handleMemoryPressure();
      
      expect(adapter.preparedStatements.size).toBeLessThanOrEqual(50);
      expect(adapter.slowQueries.length).toBeLessThanOrEqual(5);
    });
  });
});
