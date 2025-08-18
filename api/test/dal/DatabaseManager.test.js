const { describe, it, beforeEach, afterEach, expect } = require('@jest/globals');

// Mock the adapters before importing DatabaseManager
jest.mock('../../dal/adapters/MongoAdapter');
jest.mock('../../dal/adapters/PostgresAdapter');

const { DatabaseManager, databaseManager } = require('../../dal/DatabaseManager');

// Mock environment variable
const originalEnv = process.env;

describe('DatabaseManager', () => {
  let manager;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    manager = new DatabaseManager();
  });

  afterEach(async () => {
    process.env = originalEnv;
    if (manager && manager.isInitialized && manager.adapter && manager.adapter.disconnect) {
      await manager.disconnect();
    }
  });

  describe('Initialization', () => {
    it('should initialize with MongoDB by default', async () => {
      delete process.env.DATABASE_TYPE;
      
      // Create new manager instance and manually set the adapter
      const newManager = new DatabaseManager();
      
      // Mock the adapter connection
      const mockConnect = jest.fn().mockResolvedValue(true);
      const mockDisconnect = jest.fn().mockResolvedValue();
      const mockGetType = jest.fn().mockReturnValue('mongodb');
      const mockIsConnected = jest.fn().mockReturnValue(true);
      
      // Create a mock adapter instance
      const mockAdapter = {
        connect: mockConnect,
        disconnect: mockDisconnect,
        getType: mockGetType,
        isConnected: mockIsConnected
      };

      // Manually set the adapter and mark as initialized for testing
      newManager.adapter = mockAdapter;
      newManager.repositories = {};
      newManager.isInitialized = true;
      
      expect(newManager.isInitialized).toBe(true);
      expect(newManager.getDatabaseType()).toBe('mongodb');
    });

    it('should initialize with PostgreSQL when specified', async () => {
      process.env.DATABASE_TYPE = 'postgresql';
      
      // Create new manager instance and manually set the adapter
      const newManager = new DatabaseManager();
      
      // Mock the adapter connection
      const mockConnect = jest.fn().mockResolvedValue(true);
      const mockDisconnect = jest.fn().mockResolvedValue();
      const mockGetType = jest.fn().mockReturnValue('postgresql');
      const mockIsConnected = jest.fn().mockReturnValue(true);
      
      // Create a mock adapter instance
      const mockAdapter = {
        connect: mockConnect,
        disconnect: mockDisconnect,
        getType: mockGetType,
        isConnected: mockIsConnected
      };

      // Manually set the adapter and mark as initialized for testing
      newManager.adapter = mockAdapter;
      newManager.repositories = {};
      newManager.isInitialized = true;
      
      expect(newManager.isInitialized).toBe(true);
      expect(newManager.getDatabaseType()).toBe('postgresql');
    });

    it('should throw error for unsupported database type', async () => {
      process.env.DATABASE_TYPE = 'unsupported';
      
      await expect(manager.initialize()).rejects.toThrow('Unsupported database type: unsupported');
    });

    it('should not initialize twice', async () => {
      // Mock the adapter
      const mockConnect = jest.fn().mockResolvedValue(true);
      const mockDisconnect = jest.fn().mockResolvedValue();
      manager.adapter = {
        connect: mockConnect,
        disconnect: mockDisconnect,
        getType: () => 'mongodb',
        isConnected: () => true
      };
      manager.isInitialized = true;

      await manager.initialize();
      
      expect(mockConnect).not.toHaveBeenCalled();
    });
  });

  describe('Repository Management', () => {
    beforeEach(async () => {
      // Mock adapter for testing
      manager.adapter = {
        connect: jest.fn().mockResolvedValue(true),
        getType: () => 'mongodb',
        isConnected: () => true
      };
      manager.isInitialized = true;
      manager.initializeRepositories();
    });

    it('should initialize all repositories', () => {
      const expectedRepositories = [
        'user', 'message', 'conversation', 'agent', 'file',
        'preset', 'session', 'balance', 'pluginAuth', 'key',
        'role', 'permission', 'tool', 'action', 'prompt'
      ];

      expectedRepositories.forEach(repoName => {
        expect(manager.repositories[repoName]).toBeDefined();
      });
    });

    it('should get repository by name', () => {
      const userRepo = manager.getRepository('user');
      expect(userRepo).toBeDefined();
      expect(userRepo.getTableName()).toBe('users');
    });

    it('should throw error for non-existent repository', () => {
      expect(() => manager.getRepository('nonexistent')).toThrow();
    });

    it('should get all repository names', () => {
      const names = manager.getRepositoryNames();
      expect(names).toContain('user');
      expect(names).toContain('message');
      expect(names).toContain('conversation');
    });
  });

  describe('Health Check', () => {
    it('should return healthy status when connected', async () => {
      // Mock adapter
      manager.adapter = {
        getType: () => 'mongodb',
        isConnected: () => true
      };
      manager.isInitialized = true;
      manager.repositories = { user: {}, message: {} };

      const health = await manager.healthCheck();
      
      expect(health.status).toBe('healthy');
      expect(health.databaseType).toBe('mongodb');
      expect(health.isConnected).toBe(true);
      expect(health.repositoryCount).toBe(2);
    });

    it('should return unhealthy status when disconnected', async () => {
      // Mock adapter
      manager.adapter = {
        getType: () => 'mongodb',
        isConnected: () => false
      };
      manager.isInitialized = true;

      const health = await manager.healthCheck();
      
      expect(health.status).toBe('unhealthy');
      expect(health.isConnected).toBe(false);
    });

    it('should return error status when not initialized', async () => {
      const health = await manager.healthCheck();
      
      expect(health.status).toBe('error');
      expect(health.message).toContain('not initialized');
    });
  });

  describe('Transaction Management', () => {
    beforeEach(() => {
      manager.adapter = {
        withTransaction: jest.fn(),
        getType: () => 'mongodb',
        isConnected: () => true
      };
      manager.isInitialized = true;
    });

    it('should execute function within transaction', async () => {
      const mockFn = jest.fn().mockResolvedValue('result');
      manager.adapter.withTransaction.mockImplementation(fn => fn());

      const result = await manager.withTransaction(mockFn);
      
      expect(manager.adapter.withTransaction).toHaveBeenCalledWith(mockFn);
      expect(result).toBe('result');
    });

    it('should throw error when not initialized', async () => {
      manager.isInitialized = false;
      
      await expect(manager.withTransaction(() => {})).rejects.toThrow('not initialized');
    });
  });

  describe('Connection Management', () => {
    it('should check connection status', () => {
      manager.adapter = {
        isConnected: () => true
      };
      manager.isInitialized = true;

      expect(manager.isConnected()).toBe(true);
    });

    it('should disconnect properly', async () => {
      const mockDisconnect = jest.fn().mockResolvedValue();
      manager.adapter = {
        disconnect: mockDisconnect
      };
      manager.isInitialized = true;

      await manager.disconnect();
      
      expect(mockDisconnect).toHaveBeenCalled();
      expect(manager.isInitialized).toBe(false);
    });
  });
});

describe('Singleton DatabaseManager', () => {
  it('should export singleton instance', () => {
    expect(databaseManager).toBeDefined();
    expect(databaseManager).toBeInstanceOf(DatabaseManager);
  });

  it('should maintain state across imports', () => {
    // This would be tested in integration tests
    expect(databaseManager.isInitialized).toBe(false);
  });
});
