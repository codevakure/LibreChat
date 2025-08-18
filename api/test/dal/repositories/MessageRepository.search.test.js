const MessageRepository = require('../../../dal/repositories/MessageRepository');
const SearchIndexer = require('../../../dal/plugins/SearchIndexer');

// Mock the SearchIndexer
jest.mock('../../../dal/plugins/SearchIndexer');

describe('MessageRepository with Search Integration', () => {
  let messageRepository;
  let mockAdapter;
  let mockSearchIndexer;

  beforeEach(() => {
    mockAdapter = {
      getType: jest.fn().mockReturnValue('mongodb'),
      findMany: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      updateById: jest.fn(),
      deleteById: jest.fn(),
      count: jest.fn(),
      aggregate: jest.fn()
    };

    mockSearchIndexer = {
      isEnabled: jest.fn().mockReturnValue(true),
      indexDocument: jest.fn().mockResolvedValue({ taskUid: 1 }),
      updateDocument: jest.fn().mockResolvedValue({ taskUid: 2 }),
      deleteDocument: jest.fn().mockResolvedValue({ taskUid: 3 }),
      search: jest.fn().mockResolvedValue({
        hits: [
          { id: 'msg1', text: 'Hello world' },
          { id: 'msg2', text: 'How are you?' }
        ]
      }),
      syncCollection: jest.fn().mockResolvedValue(10),
      getIndexStats: jest.fn().mockResolvedValue({ documents: 100 })
    };

    SearchIndexer.mockImplementation(() => mockSearchIndexer);

    messageRepository = new MessageRepository(mockAdapter, {
      search: { enabled: true }
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with search indexer', () => {
      expect(SearchIndexer).toHaveBeenCalledWith(mockAdapter, { enabled: true });
      expect(messageRepository.searchIndexer).toBe(mockSearchIndexer);
    });
  });

  describe('create', () => {
    it('should create message and index it', async () => {
      const messageData = {
        conversationId: 'conv1',
        text: 'Hello world',
        user: 'user1'
      };

      const createdMessage = { _id: 'msg1', ...messageData };
      
      // Mock BaseRepository.create which calls validateData and adds timestamps
      const validateDataSpy = jest.spyOn(messageRepository, 'validateData')
        .mockReturnValue(messageData);
      mockAdapter.create.mockResolvedValue(createdMessage);

      const result = await messageRepository.create(messageData);

      expect(validateDataSpy).toHaveBeenCalledWith(messageData, 'create');
      expect(mockAdapter.create).toHaveBeenCalledWith('messages', expect.objectContaining({
        ...messageData,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date)
      }));
      expect(mockSearchIndexer.indexDocument).toHaveBeenCalledWith('messages', createdMessage);
      expect(result).toEqual(createdMessage);
      
      validateDataSpy.mockRestore();
    });

    it('should handle indexing failure gracefully', async () => {
      const messageData = { conversationId: 'conv1', text: 'Hello' };
      const createdMessage = { _id: 'msg1', ...messageData };
      
      const validateDataSpy = jest.spyOn(messageRepository, 'validateData')
        .mockReturnValue(messageData);
      mockAdapter.create.mockResolvedValue(createdMessage);
      mockSearchIndexer.indexDocument.mockRejectedValue(new Error('Index failed'));

      // Should not throw error
      const result = await messageRepository.create(messageData);
      expect(result).toEqual(createdMessage);
      
      validateDataSpy.mockRestore();
    });
  });

  describe('updateById', () => {
    it('should update message and re-index it', async () => {
      const updatedMessage = { _id: 'msg1', text: 'Updated text' };
      mockAdapter.updateById.mockResolvedValue(updatedMessage);

      const result = await messageRepository.updateById('msg1', { text: 'Updated text' });

      expect(mockAdapter.updateById).toHaveBeenCalledWith('messages', 'msg1', expect.objectContaining({
        text: 'Updated text',
        updatedAt: expect.any(Date)
      }));
      expect(mockSearchIndexer.updateDocument).toHaveBeenCalledWith('messages', updatedMessage);
      expect(result).toEqual(updatedMessage);
    });
  });

  describe('deleteById', () => {
    it('should delete message and remove from index', async () => {
      mockAdapter.deleteById.mockResolvedValue(true);

      const result = await messageRepository.deleteById('msg1');

      expect(mockAdapter.deleteById).toHaveBeenCalledWith('messages', 'msg1');
      expect(mockSearchIndexer.deleteDocument).toHaveBeenCalledWith('messages', 'msg1');
      expect(result).toBe(true);
    });
  });

  describe('searchMessages', () => {
    it('should search using MeiliSearch when enabled', async () => {
      const searchTerm = 'hello world';
      const options = { limit: 10 };

      // Mock database findMany to return full message objects
      mockAdapter.findMany.mockResolvedValue([
        { _id: 'msg1', text: 'Hello world', conversationId: 'conv1' },
        { _id: 'msg2', text: 'How are you?', conversationId: 'conv1' }
      ]);

      const result = await messageRepository.searchMessages(searchTerm, options);

      expect(mockSearchIndexer.search).toHaveBeenCalledWith('messages', searchTerm, {
        filter: undefined,
        limit: 10,
        offset: 0,
        attributesToHighlight: ['text', 'content']
      });

      expect(mockAdapter.findMany).toHaveBeenCalledWith('messages', {
        _id: { $in: ['msg1', 'msg2'] }
      }, {});

      expect(result).toHaveLength(2);
      expect(result[0].text).toBe('Hello world');
    });

    it('should fallback to database search when MeiliSearch fails', async () => {
      mockSearchIndexer.search.mockRejectedValue(new Error('Search failed'));
      
      // Mock the fallback search
      mockAdapter.findMany.mockResolvedValue([
        { _id: 'msg1', text: 'Hello world' }
      ]);

      const result = await messageRepository.searchMessages('hello', {});

      expect(mockAdapter.findMany).toHaveBeenCalled();
      expect(result).toHaveLength(1);
    });

    it('should return empty array for empty search term', async () => {
      const result = await messageRepository.searchMessages('');
      expect(result).toEqual([]);
    });
  });

  describe('markAsEdited', () => {
    it('should mark message as edited and re-index', async () => {
      const editedMessage = {
        _id: 'msg1',
        text: 'Edited text',
        isEdited: true,
        editedAt: expect.any(Date)
      };

      mockAdapter.updateById.mockResolvedValue(editedMessage);

      const result = await messageRepository.markAsEdited('msg1', 'Edited text');

      expect(mockAdapter.updateById).toHaveBeenCalledWith('messages', 'msg1', expect.objectContaining({
        text: 'Edited text',
        isEdited: true,
        editedAt: expect.any(Date),
        updatedAt: expect.any(Date)
      }));

      expect(mockSearchIndexer.updateDocument).toHaveBeenCalledWith('messages', editedMessage);
      expect(result).toEqual(editedMessage);
    });
  });

  describe('syncSearchIndex', () => {
    it('should sync messages with search index', async () => {
      const options = { batchSize: 100 };
      
      const result = await messageRepository.syncSearchIndex(options);

      expect(mockSearchIndexer.syncCollection).toHaveBeenCalledWith('messages', options);
      expect(result).toBe(10);
    });
  });

  describe('getSearchStats', () => {
    it('should return search index statistics', async () => {
      const result = await messageRepository.getSearchStats();

      expect(mockSearchIndexer.getIndexStats).toHaveBeenCalledWith('messages');
      expect(result).toEqual({ documents: 100 });
    });
  });

  describe('getTableName', () => {
    it('should return correct table name', () => {
      expect(messageRepository.getTableName()).toBe('messages');
    });
  });

  describe('validateData', () => {
    it('should validate message data for creation', () => {
      const data = {
        conversationId: 'conv1',
        text: 'Hello world'
      };

      const validated = messageRepository.validateData(data, 'create');
      expect(validated.conversationId).toBe('conv1');
      expect(validated.text).toBe('Hello world');
    });

    it('should throw error if conversationId is missing', () => {
      expect(() => {
        messageRepository.validateData({ text: 'Hello' }, 'create');
      }).toThrow('Conversation ID is required for message creation');
    });

    it('should throw error if both text and content are missing', () => {
      expect(() => {
        messageRepository.validateData({ conversationId: 'conv1' }, 'create');
      }).toThrow('Message text or content is required');
    });
  });

  describe('findByConversationId', () => {
    it('should find messages by conversation ID', async () => {
      const messages = [
        { _id: 'msg1', conversationId: 'conv1', text: 'Hello' },
        { _id: 'msg2', conversationId: 'conv1', text: 'World' }
      ];

      mockAdapter.findMany.mockResolvedValue(messages);

      const result = await messageRepository.findByConversationId('conv1');

      expect(mockAdapter.findMany).toHaveBeenCalledWith(
        'messages',
        { conversationId: 'conv1' },
        { sort: { createdAt: 1 } }
      );
      expect(result).toEqual(messages);
    });

    it('should throw error if conversation ID is missing', async () => {
      await expect(messageRepository.findByConversationId()).rejects.toThrow(
        'Conversation ID is required'
      );
    });
  });

  describe('findByUserId', () => {
    it('should find messages by user ID', async () => {
      const messages = [{ _id: 'msg1', user: 'user1', text: 'Hello' }];
      mockAdapter.findMany.mockResolvedValue(messages);

      const result = await messageRepository.findByUserId('user1');

      expect(mockAdapter.findMany).toHaveBeenCalledWith('messages', { user: 'user1' }, {});
      expect(result).toEqual(messages);
    });
  });

  describe('getLatestByConversationId', () => {
    it('should get latest messages for a conversation', async () => {
      const messages = [{ _id: 'msg1', conversationId: 'conv1' }];
      mockAdapter.findMany.mockResolvedValue(messages);

      const result = await messageRepository.getLatestByConversationId('conv1', 10);

      expect(mockAdapter.findMany).toHaveBeenCalledWith(
        'messages',
        { conversationId: 'conv1' },
        { sort: { createdAt: -1 }, limit: 10 }
      );
      expect(result).toEqual(messages);
    });
  });

  describe('countByConversationId', () => {
    it('should count messages in a conversation', async () => {
      mockAdapter.count.mockResolvedValue(5);

      const result = await messageRepository.countByConversationId('conv1');

      expect(mockAdapter.count).toHaveBeenCalledWith('messages', { conversationId: 'conv1' });
      expect(result).toBe(5);
    });
  });
});
