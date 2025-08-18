const PostgresAdapter = require('../../../dal/adapters/PostgresAdapter');
const { Pool } = require('pg');

// Mock pg Pool
jest.mock('pg');

describe('PostgresAdapter', () => {
  let adapter;
  let mockPool;
  let mockClient;

  beforeEach(() => {
    mockClient = {
      query: jest.fn(),
      release: jest.fn()
    };

    mockPool = {
      connect: jest.fn().mockResolvedValue(mockClient),
      end: jest.fn(),
      query: jest.fn(),
      ending: false
    };

    Pool.mockImplementation(() => mockPool);

    adapter = new PostgresAdapter();
    adapter.pool = mockPool; // Set directly for testing
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Connection Management', () => {
    it('should connect successfully', async () => {
      mockClient.query.mockResolvedValue({ rows: [{ now: new Date() }] });
      
      const result = await adapter.connect();
      
      expect(Pool).toHaveBeenCalledWith({
        host: 'localhost',
        port: 5432,
        database: 'librechat',
        user: 'librechat_user',
        password: undefined,
        ssl: false,
        max: 20,
        connectionTimeoutMillis: 30000
      });
      expect(result).toBe(mockPool);
    });

    it('should disconnect successfully', async () => {
      await adapter.disconnect();
      
      expect(mockPool.end).toHaveBeenCalled();
      expect(adapter.pool).toBeNull();
    });

    it('should return correct database type', () => {
      expect(adapter.getType()).toBe('postgresql');
    });

    it('should check connection status', () => {
      expect(adapter.isConnected()).toBe(true);
      
      mockPool.ending = true;
      expect(adapter.isConnected()).toBe(false);
    });
  });

  describe('Field/Table Name Conversion', () => {
    it('should convert MongoDB collection names to PostgreSQL table names', () => {
      expect(adapter.getTableName('users')).toBe('users');
      expect(adapter.getTableName('messages')).toBe('messages');
      expect(adapter.getTableName('conversations')).toBe('conversations');
      expect(adapter.getTableName('sessions')).toBe('sessions');
    });

    it('should convert MongoDB field names to PostgreSQL columns', () => {
      expect(adapter.convertFieldToColumn('conversationId')).toBe('conversation_id');
      expect(adapter.convertFieldToColumn('messageId')).toBe('message_id');
      expect(adapter.convertFieldToColumn('isCreatedByUser')).toBe('is_created_by_user');
      expect(adapter.convertFieldToColumn('tokenCount')).toBe('token_count');
      expect(adapter.convertFieldToColumn('createdAt')).toBe('created_at');
    });
  });

  describe('Document Conversion', () => {
    it('should convert PostgreSQL row to MongoDB-like document', () => {
      const pgRow = {
        id: 'uuid-123',
        message_id: 'msg-456',
        conversation_id: 'conv-789',
        is_created_by_user: true,
        token_count: 150,
        user_id: 'user-123',
        created_at: '2023-01-01T00:00:00Z'
      };

      const doc = adapter.convertToDocument(pgRow, 'messages');

      expect(doc).toEqual({
        _id: 'uuid-123',
        id: 'uuid-123',
        messageId: 'msg-456',
        conversationId: 'conv-789',
        isCreatedByUser: true,
        tokenCount: 150,
        user: 'user-123',
        createdAt: '2023-01-01T00:00:00Z'
      });
    });

    it('should handle null/undefined rows', () => {
      expect(adapter.convertToDocument(null, 'users')).toBeNull();
      expect(adapter.convertToDocument(undefined, 'users')).toBeNull();
    });

    it('should convert MongoDB document to PostgreSQL row', () => {
      const mongoDoc = {
        messageId: 'msg-456',
        conversationId: 'conv-789',
        isCreatedByUser: true,
        tokenCount: 150,
        user: 'user-123',
        createdAt: '2023-01-01T00:00:00Z'
      };

      const row = adapter.convertToRow(mongoDoc, 'messages');

      expect(row).toEqual({
        message_id: 'msg-456',
        conversation_id: 'conv-789',
        is_created_by_user: true,
        token_count: 150,
        user_id: 'user-123',
        created_at: '2023-01-01T00:00:00Z'
      });
    });
  });

  describe('Query Building', () => {
    it('should build simple WHERE clause', () => {
      const query = { user: 'user123', messageId: 'msg456' };
      const { whereClause, values } = adapter.buildWhereClause(query);

      expect(whereClause).toBe('WHERE user = $1 AND message_id = $2');
      expect(values).toEqual(['user123', 'msg456']);
    });

    it('should build WHERE clause with MongoDB operators', () => {
      const query = {
        tokenCount: { $gt: 100 },
        messageId: { $in: ['msg1', 'msg2'] },
        user: { $ne: 'user123' }
      };
      const { whereClause, values } = adapter.buildWhereClause(query);

      expect(whereClause).toBe('WHERE token_count > $1 AND message_id IN ($2,$3) AND user != $4');
      expect(values).toEqual([100, 'msg1', 'msg2', 'user123']);
    });
  });

  describe('CRUD Operations', () => {
    describe('findById', () => {
      it('should find message by messageId', async () => {
        const mockRow = {
          id: 'uuid-123',
          message_id: 'msg-456',
          user_id: 'user-123',
          text: 'Hello world'
        };
        mockPool.query.mockResolvedValue({ rows: [mockRow] });

        const result = await adapter.findById('messages', 'msg-456');

        expect(mockPool.query).toHaveBeenCalledWith(
          'SELECT * FROM messages WHERE message_id = $1',
          ['msg-456']
        );
        expect(result.messageId).toBe('msg-456');
        expect(result.user).toBe('user-123');
      });

      it('should find user by id', async () => {
        const mockRow = {
          id: 'uuid-123',
          email: 'test@example.com',
          username: 'testuser'
        };
        mockPool.query.mockResolvedValue({ rows: [mockRow] });

        const result = await adapter.findById('users', 'uuid-123');

        expect(mockPool.query).toHaveBeenCalledWith(
          'SELECT * FROM users WHERE id = $1',
          ['uuid-123']
        );
        expect(result.id).toBe('uuid-123');
        expect(result.email).toBe('test@example.com');
      });

      it('should return null when document not found', async () => {
        mockPool.query.mockResolvedValue({ rows: [] });

        const result = await adapter.findById('messages', 'nonexistent');

        expect(result).toBeNull();
      });
    });

    describe('findOne', () => {
      it('should find one document with query', async () => {
        const mockRow = {
          id: 'uuid-123',
          email: 'test@example.com',
          username: 'testuser'
        };
        mockPool.query.mockResolvedValue({ rows: [mockRow] });

        const result = await adapter.findOne('users', { email: 'test@example.com' });

        expect(mockPool.query).toHaveBeenCalledWith(
          'SELECT * FROM users WHERE email = $1 LIMIT 1',
          ['test@example.com']
        );
        expect(result.email).toBe('test@example.com');
      });
    });

    describe('findMany', () => {
      it('should find multiple documents', async () => {
        const mockRows = [
          { id: 'uuid-1', message_id: 'msg-1', user_id: 'user-123' },
          { id: 'uuid-2', message_id: 'msg-2', user_id: 'user-123' }
        ];
        mockPool.query.mockResolvedValue({ rows: mockRows });

        const result = await adapter.findMany('messages', { user: 'user-123' });

        expect(mockPool.query).toHaveBeenCalledWith(
          'SELECT * FROM messages WHERE user = $1',
          ['user-123']
        );
        expect(result).toHaveLength(2);
        expect(result[0].user).toBe('user-123');
      });

      it('should handle sorting and pagination', async () => {
        mockPool.query.mockResolvedValue({ rows: [] });

        await adapter.findMany('messages', { user: 'user-123' }, {
          sort: { createdAt: -1 },
          limit: 10,
          skip: 5
        });

        expect(mockPool.query).toHaveBeenCalledWith(
          'SELECT * FROM messages WHERE user = $1 ORDER BY created_at DESC LIMIT 10 OFFSET 5',
          ['user-123']
        );
      });
    });

    describe('create', () => {
      it('should create a new document', async () => {
        const newMessage = {
          messageId: 'msg-new',
          conversationId: 'conv-123',
          user: 'user-123',
          text: 'New message'
        };
        const mockRow = {
          id: 'uuid-new',
          message_id: 'msg-new',
          conversation_id: 'conv-123',
          user_id: 'user-123',
          text: 'New message'
        };
        mockPool.query.mockResolvedValue({ rows: [mockRow] });

        const result = await adapter.create('messages', newMessage);

        expect(mockPool.query).toHaveBeenCalledWith(
          expect.stringContaining('INSERT INTO messages'),
          expect.arrayContaining(['New message', 'msg-new', 'conv-123', 'user-123'])
        );
        expect(result.messageId).toBe('msg-new');
        expect(result.user).toBe('user-123');
      });
    });

    describe('updateById', () => {
      it('should update document by messageId', async () => {
        const update = { text: 'Updated text', tokenCount: 200 };
        const mockRow = {
          id: 'uuid-123',
          message_id: 'msg-456',
          text: 'Updated text',
          token_count: 200
        };
        mockPool.query.mockResolvedValue({ rows: [mockRow] });

        const result = await adapter.updateById('messages', 'msg-456', update);

        expect(mockPool.query).toHaveBeenCalledWith(
          expect.stringContaining('UPDATE messages'),
          expect.arrayContaining(['Updated text', 200, 'msg-456'])
        );
        expect(result.text).toBe('Updated text');
        expect(result.tokenCount).toBe(200);
      });
    });

    describe('deleteById', () => {
      it('should delete document by messageId', async () => {
        mockPool.query.mockResolvedValue({ rowCount: 1 });

        const result = await adapter.deleteById('messages', 'msg-456');

        expect(mockPool.query).toHaveBeenCalledWith(
          'DELETE FROM messages WHERE message_id = $1',
          ['msg-456']
        );
        expect(result).toBe(true);
      });

      it('should return false when document not found', async () => {
        mockPool.query.mockResolvedValue({ rowCount: 0 });

        const result = await adapter.deleteById('messages', 'nonexistent');

        expect(result).toBe(false);
      });
    });

    describe('deleteMany', () => {
      it('should delete multiple documents', async () => {
        mockPool.query.mockResolvedValue({ rowCount: 3 });

        const result = await adapter.deleteMany('messages', { user: 'user-123' });

        expect(mockPool.query).toHaveBeenCalledWith(
          'DELETE FROM messages WHERE user = $1',
          ['user-123']
        );
        expect(result.deletedCount).toBe(3);
      });
    });

    describe('count', () => {
      it('should count documents', async () => {
        mockPool.query.mockResolvedValue({ rows: [{ count: '5' }] });

        const result = await adapter.count('messages', { user: 'user-123' });

        expect(mockPool.query).toHaveBeenCalledWith(
          'SELECT COUNT(*) as count FROM messages WHERE user = $1',
          ['user-123']
        );
        expect(result).toBe(5);
      });
    });

    describe('findOneAndUpdate', () => {
      it('should find and update existing document', async () => {
        const query = { messageId: 'msg-456' };
        const update = { text: 'Updated text' };
        
        // Mock findOne to return existing document
        const existingDoc = { messageId: 'msg-456', text: 'Original text' };
        jest.spyOn(adapter, 'findOne').mockResolvedValue(existingDoc);
        
        // Mock updateById to return updated document
        const updatedDoc = { messageId: 'msg-456', text: 'Updated text' };
        jest.spyOn(adapter, 'updateById').mockResolvedValue(updatedDoc);

        const result = await adapter.findOneAndUpdate('messages', query, update);

        expect(adapter.findOne).toHaveBeenCalledWith('messages', query);
        expect(adapter.updateById).toHaveBeenCalledWith('messages', 'msg-456', update);
        expect(result).toEqual(updatedDoc);
      });

      it('should create new document when upsert is true and document not found', async () => {
        const query = { messageId: 'msg-new' };
        const update = { text: 'New text' };
        
        // Mock findOne to return null (document not found)
        jest.spyOn(adapter, 'findOne').mockResolvedValue(null);
        
        // Mock create to return new document
        const newDoc = { messageId: 'msg-new', text: 'New text' };
        jest.spyOn(adapter, 'create').mockResolvedValue(newDoc);

        const result = await adapter.findOneAndUpdate('messages', query, update, { upsert: true });

        expect(adapter.findOne).toHaveBeenCalledWith('messages', query);
        expect(adapter.create).toHaveBeenCalledWith('messages', { ...query, ...update });
        expect(result).toEqual(newDoc);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle connection errors', async () => {
      mockPool.connect.mockRejectedValue(new Error('Connection failed'));

      await expect(adapter.connect()).rejects.toThrow('Connection failed');
    });

    it('should handle query errors', async () => {
      mockPool.query.mockRejectedValue(new Error('Query failed'));

      await expect(adapter.findById('messages', 'msg-123')).rejects.toThrow('Query failed');
    });
  });
});

describe('PostgresAdapter Integration', () => {
  it('should work with actual PostgreSQL operations structure', () => {
    const adapter = new PostgresAdapter();
    
    // Test that all required methods exist
    expect(typeof adapter.connect).toBe('function');
    expect(typeof adapter.disconnect).toBe('function');
    expect(typeof adapter.findById).toBe('function');
    expect(typeof adapter.findOne).toBe('function');
    expect(typeof adapter.findMany).toBe('function');
    expect(typeof adapter.create).toBe('function');
    expect(typeof adapter.updateById).toBe('function');
    expect(typeof adapter.deleteById).toBe('function');
    expect(typeof adapter.deleteMany).toBe('function');
    expect(typeof adapter.count).toBe('function');
    expect(typeof adapter.findOneAndUpdate).toBe('function');
    expect(typeof adapter.getType).toBe('function');
  });
});
