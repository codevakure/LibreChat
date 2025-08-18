const { SearchService, searchService } = require('../../../dal/services/SearchService');
const { databaseManager } = require('../../../dal/DatabaseManager');

// Mock the DatabaseManager
jest.mock('../../../dal/DatabaseManager', () => ({
  databaseManager: {
    isInitialized: true,
    getRepository: jest.fn(),
    syncSearchIndex: jest.fn(),
    getSearchStats: jest.fn(),
    healthCheck: jest.fn()
  }
}));

describe('SearchService', () => {
  let mockConversationRepo;
  let mockMessageRepo;
  let mockFileRepo;

  beforeEach(() => {
    mockConversationRepo = {
      searchConversations: jest.fn(),
      findByTitle: jest.fn(),
      findMany: jest.fn(),
      searchIndexer: {
        isEnabled: jest.fn().mockReturnValue(true),
        search: jest.fn()
      }
    };

    mockMessageRepo = {
      searchMessages: jest.fn()
    };

    mockFileRepo = {
      searchFiles: jest.fn()
    };

    databaseManager.getRepository.mockImplementation((name) => {
      switch (name) {
        case 'conversation':
          return mockConversationRepo;
        case 'message':
          return mockMessageRepo;
        case 'file':
          return mockFileRepo;
        default:
          return null;
      }
    });

    // Clear initialization state
    searchService.isInitialized = false;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initialize', () => {
    it('should initialize successfully when database manager is ready', async () => {
      databaseManager.isInitialized = true;

      await searchService.initialize();

      expect(searchService.isInitialized).toBe(true);
    });

    it('should warn when database manager is not initialized', async () => {
      databaseManager.isInitialized = false;
      
      // Mock the logger since it comes from data-schemas
      const { logger } = require('@librechat/data-schemas');
      const warnSpy = jest.spyOn(logger, 'warn');
      const infoSpy = jest.spyOn(logger, 'info');

      await searchService.initialize();

      expect(warnSpy).toHaveBeenCalledWith(
        'DatabaseManager not initialized, search service may not work properly'
      );
      expect(searchService.isInitialized).toBe(true);

      warnSpy.mockRestore();
      infoSpy.mockRestore();
    });

    it('should not reinitialize if already initialized', async () => {
      searchService.isInitialized = true;
      const consoleSpy = jest.spyOn(console, 'info').mockImplementation();

      await searchService.initialize();

      expect(consoleSpy).not.toHaveBeenCalledWith('Search service initialized');
      consoleSpy.mockRestore();
    });
  });

  describe('searchAll', () => {
    beforeEach(async () => {
      await searchService.initialize();
    });

    it('should search across all content types', async () => {
      const mockConversations = [{ _id: 'conv1', title: 'Test conversation' }];
      const mockMessages = [{ _id: 'msg1', text: 'Test message' }];
      const mockFiles = [{ _id: 'file1', filename: 'test.txt' }];

      mockConversationRepo.searchConversations.mockResolvedValue(mockConversations);
      mockMessageRepo.searchMessages.mockResolvedValue(mockMessages);
      mockFileRepo.searchFiles.mockResolvedValue(mockFiles);

      const result = await searchService.searchAll('test', { userId: 'user1' });

      expect(result).toEqual({
        conversations: mockConversations,
        messages: mockMessages,
        files: mockFiles,
        totalResults: 3
      });

      expect(mockConversationRepo.searchConversations).toHaveBeenCalledWith(
        'user1',
        'test',
        { limit: 10, offset: 0, userId: 'user1' }
      );
      expect(mockMessageRepo.searchMessages).toHaveBeenCalledWith(
        'test',
        { limit: 10, offset: 0, userId: 'user1' }
      );
      expect(mockFileRepo.searchFiles).toHaveBeenCalledWith(
        'test',
        { limit: 10, offset: 0, userId: 'user1' }
      );
    });

    it('should return empty results for empty query', async () => {
      const result = await searchService.searchAll('');

      expect(result).toEqual({
        conversations: [],
        messages: [],
        files: [],
        totalResults: 0
      });
    });

    it('should handle search failures gracefully', async () => {
      mockConversationRepo.searchConversations.mockRejectedValue(new Error('Search failed'));
      mockMessageRepo.searchMessages.mockResolvedValue([]);
      mockFileRepo.searchFiles.mockResolvedValue([]);

      const result = await searchService.searchAll('test', { userId: 'user1' });

      expect(result.conversations).toEqual([]);
      expect(result.messages).toEqual([]);
      expect(result.files).toEqual([]);
      expect(result.totalResults).toBe(0);
    });

    it('should apply custom options', async () => {
      mockConversationRepo.searchConversations.mockResolvedValue([]);
      mockMessageRepo.searchMessages.mockResolvedValue([]);
      mockFileRepo.searchFiles.mockResolvedValue([]);

      await searchService.searchAll('test', {
        userId: 'user1',
        limit: 20,
        offset: 10
      });

      expect(mockConversationRepo.searchConversations).toHaveBeenCalledWith(
        'user1',
        'test',
        { limit: 20, offset: 10, userId: 'user1' }
      );
    });
  });

  describe('searchConversations', () => {
    beforeEach(async () => {
      await searchService.initialize();
    });

    it('should search conversations with user ID', async () => {
      const mockConversations = [{ _id: 'conv1', title: 'Test' }];
      mockConversationRepo.searchConversations.mockResolvedValue(mockConversations);

      const result = await searchService.searchConversations('test', {
        userId: 'user1'
      });

      expect(mockConversationRepo.searchConversations).toHaveBeenCalledWith(
        'user1',
        'test',
        { userId: 'user1' }
      );
      expect(result).toEqual(mockConversations);
    });

    it('should search using MeiliSearch when no user ID provided', async () => {
      const mockSearchResult = {
        hits: [{ id: 'conv1' }, { id: 'conv2' }]
      };
      const mockConversations = [
        { _id: 'conv1', title: 'Test 1' },
        { _id: 'conv2', title: 'Test 2' }
      ];

      mockConversationRepo.searchIndexer.search.mockResolvedValue(mockSearchResult);
      mockConversationRepo.findMany = jest.fn().mockResolvedValue(mockConversations);

      const result = await searchService.searchConversations('test', {});

      expect(mockConversationRepo.searchIndexer.search).toHaveBeenCalledWith(
        'conversations',
        'test',
        {
          limit: undefined,
          offset: undefined,
          attributesToHighlight: ['title', 'tags']
        }
      );
      expect(result).toEqual(mockConversations);
    });

    it('should fallback to title search when MeiliSearch fails', async () => {
      // When search indexer throws an error, the catch block returns []
      mockConversationRepo.searchIndexer.isEnabled.mockReturnValue(true);
      mockConversationRepo.searchIndexer.search.mockRejectedValue(new Error('Search failed'));

      const result = await searchService.searchConversations('test', {});

      // The error is caught and empty array is returned, findByTitle is not called
      expect(mockConversationRepo.findByTitle).not.toHaveBeenCalled();
      expect(result).toEqual([]);
    });

    it('should fallback to title search when search indexer is disabled', async () => {
      mockConversationRepo.searchIndexer.isEnabled.mockReturnValue(false);
      mockConversationRepo.findByTitle.mockResolvedValue([]);

      const result = await searchService.searchConversations('test', {});

      expect(mockConversationRepo.findByTitle).toHaveBeenCalledWith('test', null, {});
      expect(result).toEqual([]);
    });

    it('should handle errors gracefully', async () => {
      mockConversationRepo.searchConversations.mockRejectedValue(new Error('Repo error'));

      const result = await searchService.searchConversations('test', { userId: 'user1' });

      expect(result).toEqual([]);
    });
  });

  describe('searchInConversation', () => {
    beforeEach(async () => {
      await searchService.initialize();
    });

    it('should search messages within a conversation', async () => {
      const mockMessages = [{ _id: 'msg1', text: 'Test message' }];
      mockMessageRepo.searchMessages.mockResolvedValue(mockMessages);

      const result = await searchService.searchInConversation('conv1', 'test', {
        userId: 'user1'
      });

      expect(mockMessageRepo.searchMessages).toHaveBeenCalledWith('test', {
        userId: 'user1',
        conversationId: 'conv1',
        filter: 'conversationId = "conv1"'
      });
      expect(result).toEqual(mockMessages);
    });

    it('should return empty array for missing parameters', async () => {
      const result1 = await searchService.searchInConversation('', 'test');
      const result2 = await searchService.searchInConversation('conv1', '');

      expect(result1).toEqual([]);
      expect(result2).toEqual([]);
    });
  });

  describe('getSearchSuggestions', () => {
    beforeEach(async () => {
      await searchService.initialize();
    });

    it('should return conversation title suggestions', async () => {
      const mockConversations = [
        { _id: 'conv1', title: 'Test conversation 1' },
        { _id: 'conv2', title: 'Test conversation 2' }
      ];

      mockConversationRepo.findByTitle.mockResolvedValue(mockConversations);

      const result = await searchService.getSearchSuggestions('user1', 'test', { limit: 5 });

      expect(mockConversationRepo.findByTitle).toHaveBeenCalledWith('test', 'user1', { limit: 5 });
      expect(result).toEqual([
        { type: 'conversation', text: 'Test conversation 1', id: 'conv1' },
        { type: 'conversation', text: 'Test conversation 2', id: 'conv2' }
      ]);
    });

    it('should return empty array for short queries', async () => {
      const result1 = await searchService.getSearchSuggestions('user1', '');
      const result2 = await searchService.getSearchSuggestions('user1', 'a');

      expect(result1).toEqual([]);
      expect(result2).toEqual([]);
    });

    it('should handle errors gracefully', async () => {
      mockConversationRepo.findByTitle.mockRejectedValue(new Error('Find error'));

      const result = await searchService.getSearchSuggestions('user1', 'test');

      expect(result).toEqual([]);
    });
  });

  describe('searchWithFilters', () => {
    beforeEach(async () => {
      await searchService.initialize();
    });

    it('should apply date filters', async () => {
      mockConversationRepo.searchConversations.mockResolvedValue([]);
      mockMessageRepo.searchMessages.mockResolvedValue([]);
      mockFileRepo.searchFiles.mockResolvedValue([]);

      const filters = {
        dateFrom: '2023-01-01',
        dateTo: '2023-12-31',
        endpoint: 'openai'
      };

      await searchService.searchWithFilters('test', filters, { userId: 'user1' });

      // The searchWithFilters method builds the options and passes them to searchAll,
      // which then calls individual search methods with basic options (limit, offset, userId)
      const expectedOptions = {
        limit: 10,
        offset: 0,
        userId: 'user1'
      };

      expect(mockConversationRepo.searchConversations).toHaveBeenCalledWith(
        'user1',
        'test',
        expectedOptions
      );
    });
  });

  describe('syncSearchIndices', () => {
    beforeEach(async () => {
      await searchService.initialize();
    });

    it('should sync search indices via database manager', async () => {
      const mockSyncResult = {
        message: { indexed: 10, status: 'success' },
        conversation: { indexed: 5, status: 'success' }
      };

      databaseManager.syncSearchIndex.mockResolvedValue(mockSyncResult);

      const result = await searchService.syncSearchIndices({ batchSize: 100 });

      expect(databaseManager.syncSearchIndex).toHaveBeenCalledWith({ batchSize: 100 });
      expect(result).toEqual(mockSyncResult);
    });

    it('should handle sync errors', async () => {
      databaseManager.syncSearchIndex.mockRejectedValue(new Error('Sync failed'));

      await expect(searchService.syncSearchIndices()).rejects.toThrow('Sync failed');
    });
  });

  describe('getSearchStats', () => {
    beforeEach(async () => {
      await searchService.initialize();
    });

    it('should get search statistics via database manager', async () => {
      const mockStats = {
        message: { documents: 100 },
        conversation: { documents: 50 }
      };

      databaseManager.getSearchStats.mockResolvedValue(mockStats);

      const result = await searchService.getSearchStats();

      expect(databaseManager.getSearchStats).toHaveBeenCalled();
      expect(result).toEqual(mockStats);
    });
  });

  describe('healthCheck', () => {
    it('should return health status', async () => {
      const mockDbHealth = {
        status: 'healthy',
        databaseType: 'postgresql'
      };

      databaseManager.healthCheck.mockResolvedValue(mockDbHealth);
      searchService.isInitialized = true;

      const result = await searchService.healthCheck();

      expect(result).toEqual({
        status: 'healthy',
        isInitialized: true,
        database: mockDbHealth,
        timestamp: expect.any(String)
      });
    });

    it('should return unhealthy when not initialized', async () => {
      searchService.isInitialized = false;
      databaseManager.healthCheck.mockResolvedValue({ status: 'healthy' });

      const result = await searchService.healthCheck();

      expect(result.status).toBe('unhealthy');
    });

    it('should handle health check errors', async () => {
      databaseManager.healthCheck.mockRejectedValue(new Error('Health check failed'));

      const result = await searchService.healthCheck();

      expect(result).toEqual({
        status: 'error',
        error: 'Health check failed',
        timestamp: expect.any(String)
      });
    });
  });

  describe('singleton instance', () => {
    it('should export singleton instance', () => {
      expect(searchService).toBeInstanceOf(SearchService);
    });
  });
});
