const SearchIndexer = require('../../../dal/plugins/SearchIndexer');

// Mock MeiliSearch
jest.mock('meilisearch', () => ({
  MeiliSearch: jest.fn().mockImplementation(() => ({
    health: jest.fn().mockResolvedValue({ status: 'available' }),
    index: jest.fn().mockReturnValue({
      addDocuments: jest.fn().mockResolvedValue({ taskUid: 1 }),
      updateSearchableAttributes: jest.fn().mockResolvedValue({ taskUid: 2 }),
      updateFilterableAttributes: jest.fn().mockResolvedValue({ taskUid: 3 }),
      updateSortableAttributes: jest.fn().mockResolvedValue({ taskUid: 4 }),
      search: jest.fn().mockResolvedValue({
        hits: [
          { id: '1', title: 'Test conversation', user: 'user1' },
          { id: '2', title: 'Another conversation', user: 'user1' }
        ],
        totalHits: 2
      }),
      deleteDocument: jest.fn().mockResolvedValue({ taskUid: 5 }),
      deleteAllDocuments: jest.fn().mockResolvedValue({ taskUid: 6 }),
      getStats: jest.fn().mockResolvedValue({
        numberOfDocuments: 10,
        isIndexing: false,
        fieldDistribution: {}
      })
    })
  }))
}));

describe('SearchIndexer', () => {
  let searchIndexer;
  let mockAdapter;

  beforeEach(() => {
    mockAdapter = {
      findMany: jest.fn(),
      updateById: jest.fn(),
      updateMany: jest.fn()
    };

    searchIndexer = new SearchIndexer(mockAdapter, {
      host: 'http://localhost:7700',
      apiKey: 'test-key',
      enabled: true
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with default configuration', () => {
      const indexer = new SearchIndexer(mockAdapter);
      expect(indexer.config.host).toBe('http://localhost:7700');
      expect(indexer.config.enabled).toBe(true);
    });

    it('should initialize with custom configuration', () => {
      const config = {
        host: 'http://custom-host:7700',
        apiKey: 'custom-key',
        enabled: false
      };
      const indexer = new SearchIndexer(mockAdapter, config);
      expect(indexer.config.host).toBe('http://custom-host:7700');
      expect(indexer.config.apiKey).toBe('custom-key');
      expect(indexer.config.enabled).toBe(false);
    });

    it('should disable indexer when MeiliSearch fails to initialize', () => {
      const { MeiliSearch } = require('meilisearch');
      MeiliSearch.mockImplementationOnce(() => {
        throw new Error('Connection failed');
      });

      const indexer = new SearchIndexer(mockAdapter, { enabled: true });
      expect(indexer.config.enabled).toBe(false);
    });
  });

  describe('getSearchableAttributes', () => {
    it('should return correct attributes for conversations', () => {
      const attributes = searchIndexer.getSearchableAttributes('conversations');
      expect(attributes).toEqual(['title', 'tags']);
    });

    it('should return correct attributes for messages', () => {
      const attributes = searchIndexer.getSearchableAttributes('messages');
      expect(attributes).toEqual(['text', 'content']);
    });

    it('should return empty array for unknown collection', () => {
      const attributes = searchIndexer.getSearchableAttributes('unknown');
      expect(attributes).toEqual([]);
    });
  });

  describe('prepareForIndexing', () => {
    it('should prepare conversation document correctly', () => {
      const document = {
        _id: 'conv1',
        title: 'Test Conversation',
        user: 'user1',
        tags: ['important'],
        createdAt: new Date('2023-01-01')
      };

      const prepared = searchIndexer.prepareForIndexing('conversations', document);
      expect(prepared).toEqual({
        id: 'conv1',
        title: 'Test Conversation',
        user: 'user1',
        tags: ['important'],
        archived: false,
        pinned: false,
        messageCount: 0,
        createdAt: new Date('2023-01-01'),
        updatedAt: undefined,
        endpoint: undefined
      });
    });

    it('should prepare message document correctly', () => {
      const document = {
        _id: 'msg1',
        text: 'Hello world',
        conversationId: 'conv1',
        user: 'user1',
        tokenCount: 5,
        createdAt: new Date('2023-01-01')
      };

      const prepared = searchIndexer.prepareForIndexing('messages', document);
      expect(prepared).toEqual({
        id: 'msg1',
        text: 'Hello world',
        content: undefined,
        conversationId: 'conv1',
        user: 'user1',
        tokenCount: 5,
        createdAt: new Date('2023-01-01'),
        updatedAt: undefined,
        sender: undefined,
        model: undefined,
        endpoint: undefined
      });
    });
  });

  describe('indexDocument', () => {
    it('should index a document successfully', async () => {
      const document = {
        _id: 'conv1',
        title: 'Test Conversation',
        user: 'user1'
      };

      mockAdapter.updateById.mockResolvedValue(true);

      const result = await searchIndexer.indexDocument('conversations', document);
      
      expect(result).toEqual({ taskUid: 1 });
      expect(mockAdapter.updateById).toHaveBeenCalledWith(
        'conversations',
        'conv1',
        { indexed: true, indexedAt: expect.any(Date) }
      );
    });

    it('should return null when indexing is disabled', async () => {
      searchIndexer.config.enabled = false;
      
      const result = await searchIndexer.indexDocument('conversations', {});
      expect(result).toBeNull();
    });

    it('should handle indexing errors gracefully', async () => {
      // Mock getIndex to return a failing index
      const mockIndex = {
        addDocuments: jest.fn().mockRejectedValue(new Error('Index error')),
        updateSearchableAttributes: jest.fn().mockResolvedValue({ taskUid: 2 }),
        updateFilterableAttributes: jest.fn().mockResolvedValue({ taskUid: 3 }),
        updateSortableAttributes: jest.fn().mockResolvedValue({ taskUid: 4 })
      };
      
      jest.spyOn(searchIndexer, 'getIndex').mockResolvedValue(mockIndex);

      const result = await searchIndexer.indexDocument('conversations', { _id: 'conv1' });
      expect(result).toBeNull();
    });
  });

  describe('search', () => {
    it('should search documents successfully', async () => {
      const result = await searchIndexer.search('conversations', 'test query', {
        limit: 10,
        filter: 'user = "user1"'
      });

      expect(result.hits).toHaveLength(2);
      expect(result.hits[0].title).toBe('Test conversation');
    });

    it('should return null when search is disabled', async () => {
      searchIndexer.config.enabled = false;
      
      const result = await searchIndexer.search('conversations', 'test');
      expect(result).toBeNull();
    });

    it('should handle search errors gracefully', async () => {
      // Mock getIndex to return a failing index
      const mockIndex = {
        search: jest.fn().mockRejectedValue(new Error('Search error')),
        updateSearchableAttributes: jest.fn().mockResolvedValue({ taskUid: 2 }),
        updateFilterableAttributes: jest.fn().mockResolvedValue({ taskUid: 3 }),
        updateSortableAttributes: jest.fn().mockResolvedValue({ taskUid: 4 })
      };
      
      jest.spyOn(searchIndexer, 'getIndex').mockResolvedValue(mockIndex);

      const result = await searchIndexer.search('conversations', 'test');
      expect(result).toBeNull();
    });
  });

  describe('syncCollection', () => {
    it('should sync unindexed documents', async () => {
      const unindexedDocs = [
        { _id: 'conv1', title: 'Conv 1' },
        { _id: 'conv2', title: 'Conv 2' }
      ];

      mockAdapter.findMany
        .mockResolvedValueOnce(unindexedDocs)
        .mockResolvedValueOnce([]); // Second call returns empty array

      mockAdapter.updateMany.mockResolvedValue(true);

      const indexed = await searchIndexer.syncCollection('conversations');
      expect(indexed).toBe(2);
    });

    it('should handle batch processing', async () => {
      const docs1 = Array.from({ length: 2 }, (_, i) => ({ _id: `conv${i}`, title: `Conv ${i}` }));
      const docs2 = [];

      mockAdapter.findMany
        .mockResolvedValueOnce(docs1)
        .mockResolvedValueOnce(docs2);

      mockAdapter.updateMany.mockResolvedValue(true);

      const indexed = await searchIndexer.syncCollection('conversations', { batchSize: 2 });
      expect(indexed).toBe(2);
    });
  });

  describe('healthCheck', () => {
    it('should return healthy status when enabled and accessible', async () => {
      const health = await searchIndexer.healthCheck();
      expect(health.status).toBe('healthy');
      expect(health.message).toBe('MeiliSearch is accessible');
    });

    it('should return disabled status when disabled', async () => {
      searchIndexer.config.enabled = false;
      
      const health = await searchIndexer.healthCheck();
      expect(health.status).toBe('disabled');
      expect(health.message).toBe('MeiliSearch is disabled');
    });

    it('should return unhealthy status when health check fails', async () => {
      // Mock client health to fail
      searchIndexer.client.health.mockRejectedValue(new Error('Connection failed'));

      const health = await searchIndexer.healthCheck();
      expect(health.status).toBe('unhealthy');
      expect(health.message).toContain('MeiliSearch health check failed');
    });
  });

  describe('isEnabled', () => {
    it('should return true when enabled and client exists', () => {
      expect(searchIndexer.isEnabled()).toBe(true);
    });

    it('should return false when disabled', () => {
      searchIndexer.config.enabled = false;
      expect(searchIndexer.isEnabled()).toBe(false);
    });

    it('should return false when client is null', () => {
      searchIndexer.client = null;
      expect(searchIndexer.isEnabled()).toBe(false);
    });
  });

  describe('getIndexStats', () => {
    it('should return index statistics', async () => {
      const stats = await searchIndexer.getIndexStats('conversations');
      
      expect(stats).toEqual({
        numberOfDocuments: 10,
        isIndexing: false,
        fieldDistribution: {}
      });
    });

    it('should return null when disabled', async () => {
      searchIndexer.config.enabled = false;
      
      const stats = await searchIndexer.getIndexStats('conversations');
      expect(stats).toBeNull();
    });
  });

  describe('clearIndex', () => {
    it('should clear index and reset flags', async () => {
      mockAdapter.updateMany.mockResolvedValue(true);

      const result = await searchIndexer.clearIndex('conversations');
      
      expect(result).toBe(true);
      expect(mockAdapter.updateMany).toHaveBeenCalledWith(
        'conversations',
        {},
        { indexed: false, indexedAt: null }
      );
    });

    it('should return false when disabled', async () => {
      searchIndexer.config.enabled = false;
      
      const result = await searchIndexer.clearIndex('conversations');
      expect(result).toBe(false);
    });
  });
});
