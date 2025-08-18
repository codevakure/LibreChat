const { describe, it, beforeEach, afterEach, expect } = require('@jest/globals');
const MongoAdapter = require('../../../dal/adapters/MongoAdapter');
const { connectDb } = require('../../../db/connect');

// Mock the database connection
jest.mock('../../../db/connect');
jest.mock('../../../db/models', () => ({
  User: {
    findById: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    insertMany: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    updateMany: jest.fn(),
    findByIdAndDelete: jest.fn(),
    deleteMany: jest.fn(),
    countDocuments: jest.fn(),
    aggregate: jest.fn()
  },
  Message: {
    findById: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    insertMany: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    updateMany: jest.fn(),
    findByIdAndDelete: jest.fn(),
    deleteMany: jest.fn(),
    countDocuments: jest.fn(),
    aggregate: jest.fn()
  }
}));

describe('MongoAdapter', () => {
  let adapter;
  let mockConnection;

  beforeEach(async () => {
    // Setup mock connection
    mockConnection = {
      readyState: 1,
      on: jest.fn(),
      once: jest.fn()
    };
    
    connectDb.mockResolvedValue(mockConnection);
    
    adapter = new MongoAdapter();
    await adapter.connect();
  });

  afterEach(async () => {
    if (adapter) {
      await adapter.disconnect();
    }
    jest.clearAllMocks();
  });

  describe('Connection Management', () => {
    it('should connect successfully', async () => {
      expect(adapter.isConnected()).toBe(true);
      expect(connectDb).toHaveBeenCalled();
    });

    it('should disconnect successfully', async () => {
      await adapter.disconnect();
      expect(adapter.connection).toBeNull();
    });

    it('should return correct database type', () => {
      expect(adapter.getType()).toBe('mongodb');
    });
  });

  describe('Model Management', () => {
    it('should get model for valid collection', () => {
      expect(() => adapter.getModel('users')).not.toThrow();
    });

    it('should throw error for invalid collection', () => {
      expect(() => adapter.getModel('invalid_collection')).toThrow();
    });

    it('should normalize model names correctly', () => {
      expect(adapter._normalizeModelName('users')).toBe('User');
      expect(adapter._normalizeModelName('messages')).toBe('Message');
      expect(adapter._normalizeModelName('conversations')).toBe('Conversation');
    });
  });

  describe('Document Normalization', () => {
    it('should normalize document with _id', () => {
      const mockDoc = {
        _id: '507f1f77bcf86cd799439011',
        name: 'Test User',
        toObject: () => ({
          _id: '507f1f77bcf86cd799439011',
          name: 'Test User'
        })
      };

      const normalized = adapter._normalizeDocument(mockDoc);
      expect(normalized.id).toBe('507f1f77bcf86cd799439011');
      expect(normalized._id).toBeDefined();
    });

    it('should handle null documents', () => {
      expect(adapter._normalizeDocument(null)).toBeNull();
    });
  });

  describe('CRUD Operations', () => {
    const mockUser = {
      _id: '507f1f77bcf86cd799439011',
      name: 'Test User',
      email: 'test@example.com',
      toObject: () => ({
        _id: '507f1f77bcf86cd799439011',
        name: 'Test User',
        email: 'test@example.com'
      })
    };

    describe('findById', () => {
      it('should find document by ID', async () => {
        const mockModel = adapter.getModel('users');
        mockModel.findById.mockResolvedValue(mockUser);

        const result = await adapter.findById('users', '507f1f77bcf86cd799439011');
        
        expect(mockModel.findById).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
        expect(result.id).toBe('507f1f77bcf86cd799439011');
        expect(result.name).toBe('Test User');
      });

      it('should return null for non-existent document', async () => {
        const mockModel = adapter.getModel('users');
        mockModel.findById.mockResolvedValue(null);

        const result = await adapter.findById('users', 'nonexistent');
        expect(result).toBeNull();
      });
    });

    describe('findMany', () => {
      it('should find multiple documents', async () => {
        const mockModel = adapter.getModel('users');
        const mockQuery = {
          sort: jest.fn().mockReturnThis(),
          limit: jest.fn().mockReturnThis(),
          skip: jest.fn().mockReturnThis(),
          populate: jest.fn().mockReturnThis(),
          select: jest.fn().mockReturnThis(),
          exec: jest.fn().mockResolvedValue([mockUser])
        };
        mockModel.find.mockReturnValue(mockQuery);

        const result = await adapter.findMany('users', { active: true }, {
          sort: { name: 1 },
          limit: 10,
          skip: 0
        });

        expect(mockModel.find).toHaveBeenCalledWith({ active: true });
        expect(mockQuery.sort).toHaveBeenCalledWith({ name: 1 });
        expect(mockQuery.limit).toHaveBeenCalledWith(10);
        // skip is only called if it's greater than 0
        expect(result).toHaveLength(1);
        expect(result[0].id).toBe('507f1f77bcf86cd799439011');
      });
    });

    describe('create', () => {
      it('should create new document', async () => {
        const mockModel = adapter.getModel('users');
        mockModel.create.mockResolvedValue(mockUser);

        const userData = { name: 'New User', email: 'new@example.com' };
        const result = await adapter.create('users', userData);

        expect(mockModel.create).toHaveBeenCalledWith(userData);
        expect(result.id).toBe('507f1f77bcf86cd799439011');
      });
    });

    describe('updateById', () => {
      it('should update document by ID', async () => {
        const mockModel = adapter.getModel('users');
        const updatedUser = { 
          ...mockUser, 
          name: 'Updated User',
          toObject: () => ({
            _id: '507f1f77bcf86cd799439011',
            name: 'Updated User',
            email: 'test@example.com'
          })
        };
        mockModel.findByIdAndUpdate.mockResolvedValue(updatedUser);

        const result = await adapter.updateById('users', '507f1f77bcf86cd799439011', {
          name: 'Updated User'
        });

        expect(mockModel.findByIdAndUpdate).toHaveBeenCalledWith(
          '507f1f77bcf86cd799439011',
          { name: 'Updated User' },
          { new: true }
        );
        expect(result.name).toBe('Updated User');
      });
    });

    describe('deleteById', () => {
      it('should delete document by ID', async () => {
        const mockModel = adapter.getModel('users');
        mockModel.findByIdAndDelete.mockResolvedValue(mockUser);

        const result = await adapter.deleteById('users', '507f1f77bcf86cd799439011');

        expect(mockModel.findByIdAndDelete).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
        expect(result).toBe(true);
      });

      it('should return false when document not found', async () => {
        const mockModel = adapter.getModel('users');
        mockModel.findByIdAndDelete.mockResolvedValue(null);

        const result = await adapter.deleteById('users', 'nonexistent');
        expect(result).toBe(false);
      });
    });

    describe('count', () => {
      it('should count documents', async () => {
        const mockModel = adapter.getModel('users');
        mockModel.countDocuments.mockResolvedValue(5);

        const result = await adapter.count('users', { active: true });

        expect(mockModel.countDocuments).toHaveBeenCalledWith({ active: true });
        expect(result).toBe(5);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle connection errors', async () => {
      connectDb.mockRejectedValue(new Error('Connection failed'));
      
      const newAdapter = new MongoAdapter();
      await expect(newAdapter.connect()).rejects.toThrow('Connection failed');
    });

    it('should handle query errors', async () => {
      const mockModel = adapter.getModel('users');
      mockModel.findById.mockRejectedValue(new Error('Query failed'));

      await expect(adapter.findById('users', 'test')).rejects.toThrow('Query failed');
    });
  });
});

describe('MongoAdapter Integration', () => {
  it('should work with actual MongoDB models structure', () => {
    const adapter = new MongoAdapter();
    
    // Test model name normalization for all expected collections
    const collections = [
      'users', 'conversations', 'messages', 'agents', 'files',
      'presets', 'sessions', 'balances', 'plugin_auths'
    ];
    
    collections.forEach(collection => {
      expect(() => adapter._normalizeModelName(collection)).not.toThrow();
    });
  });
});
