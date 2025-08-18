const { logger } = require('@librechat/data-schemas');
const { databaseManager } = require('../DatabaseManager');

/**
 * Search Service
 * Unified search service that works with both database types and MeiliSearch
 */
class SearchService {
  constructor() {
    this.isInitialized = false;
  }

  /**
   * Initialize the search service
   */
  async initialize() {
    if (this.isInitialized) {
      return;
    }

    try {
      // Ensure database manager is initialized
      if (!databaseManager.isInitialized) {
        logger.warn('DatabaseManager not initialized, search service may not work properly');
      }

      this.isInitialized = true;
      logger.info('Search service initialized');
    } catch (error) {
      logger.error('Search service initialization failed:', error);
      throw error;
    }
  }

  /**
   * Search across all content types
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Promise<Object>} - Search results
   */
  async searchAll(query, options = {}) {
    await this.initialize();

    if (!query || query.trim().length === 0) {
      return {
        conversations: [],
        messages: [],
        files: [],
        totalResults: 0
      };
    }

    const searchOptions = {
      limit: options.limit || 10,
      offset: options.offset || 0,
      userId: options.userId
    };

    try {
      const [conversations, messages, files] = await Promise.allSettled([
        this.searchConversations(query, searchOptions),
        this.searchMessages(query, searchOptions),
        this.searchFiles(query, searchOptions)
      ]);

      const results = {
        conversations: conversations.status === 'fulfilled' ? conversations.value : [],
        messages: messages.status === 'fulfilled' ? messages.value : [],
        files: files.status === 'fulfilled' ? files.value : [],
        totalResults: 0
      };

      results.totalResults = results.conversations.length + results.messages.length + results.files.length;

      return results;
    } catch (error) {
      logger.error('Search all failed:', error);
      throw new Error(`Search failed: ${error.message}`);
    }
  }

  /**
   * Search conversations
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Promise<Array>} - Search results
   */
  async searchConversations(query, options = {}) {
    await this.initialize();

    try {
      const conversationRepo = databaseManager.getRepository('conversation');
      
      if (options.userId) {
        return await conversationRepo.searchConversations(options.userId, query, options);
      } else {
        // If no userId provided, use the search indexer directly
        if (conversationRepo.searchIndexer && conversationRepo.searchIndexer.isEnabled()) {
          const searchResult = await conversationRepo.searchIndexer.search('conversations', query, {
            limit: options.limit,
            offset: options.offset,
            attributesToHighlight: ['title', 'tags']
          });

          if (searchResult && searchResult.hits) {
            // Get full conversation objects from database
            const conversationIds = searchResult.hits.map(hit => hit.id);
            const conversations = await conversationRepo.findMany({ _id: { $in: conversationIds } });
            
            // Preserve search ranking order
            const conversationMap = new Map(conversations.map(conv => [conv._id || conv.id, conv]));
            return searchResult.hits
              .map(hit => conversationMap.get(hit.id))
              .filter(Boolean);
          }
        }
        
        // Fallback to title search
        return await conversationRepo.findByTitle(query, null, options);
      }
    } catch (error) {
      logger.error('Conversation search failed:', error);
      return [];
    }
  }

  /**
   * Search messages
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Promise<Array>} - Search results
   */
  async searchMessages(query, options = {}) {
    await this.initialize();

    try {
      const messageRepo = databaseManager.getRepository('message');
      return await messageRepo.searchMessages(query, options);
    } catch (error) {
      logger.error('Message search failed:', error);
      return [];
    }
  }

  /**
   * Search files
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Promise<Array>} - Search results
   */
  async searchFiles(query, options = {}) {
    await this.initialize();

    try {
      const fileRepo = databaseManager.getRepository('file');
      return await fileRepo.searchFiles(query, options);
    } catch (error) {
      logger.error('File search failed:', error);
      return [];
    }
  }

  /**
   * Search messages within a conversation
   * @param {string} conversationId - Conversation ID
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Promise<Array>} - Search results
   */
  async searchInConversation(conversationId, query, options = {}) {
    await this.initialize();

    if (!conversationId || !query) {
      return [];
    }

    try {
      const messageRepo = databaseManager.getRepository('message');
      const searchOptions = {
        ...options,
        conversationId,
        filter: `conversationId = "${conversationId}"`
      };

      return await messageRepo.searchMessages(query, searchOptions);
    } catch (error) {
      logger.error('Conversation message search failed:', error);
      return [];
    }
  }

  /**
   * Get search suggestions based on user's search history
   * @param {string} userId - User ID
   * @param {string} partialQuery - Partial search query
   * @param {Object} options - Search options
   * @returns {Promise<Array>} - Search suggestions
   */
  async getSearchSuggestions(userId, partialQuery, options = {}) {
    await this.initialize();

    if (!partialQuery || partialQuery.length < 2) {
      return [];
    }

    try {
      const limit = options.limit || 5;
      const suggestions = [];

      // Get conversation titles that match
      const conversationRepo = databaseManager.getRepository('conversation');
      const conversations = await conversationRepo.findByTitle(partialQuery, userId, { limit });
      
      suggestions.push(...conversations.map(conv => ({
        type: 'conversation',
        text: conv.title,
        id: conv._id || conv.id
      })));

      // Get recent search terms (if we store them)
      // This could be enhanced to store and retrieve user search history

      return suggestions.slice(0, limit);
    } catch (error) {
      logger.error('Search suggestions failed:', error);
      return [];
    }
  }

  /**
   * Get popular search terms
   * @param {Object} options - Options
   * @returns {Promise<Array>} - Popular search terms
   */
  async getPopularSearches(options = {}) {
    await this.initialize();

    // This is a placeholder for future implementation
    // Would require storing search analytics
    return [];
  }

  /**
   * Search with filters
   * @param {string} query - Search query
   * @param {Object} filters - Search filters
   * @param {Object} options - Search options
   * @returns {Promise<Object>} - Filtered search results
   */
  async searchWithFilters(query, filters = {}, options = {}) {
    await this.initialize();

    const searchOptions = { ...options };

    // Apply filters
    if (filters.dateFrom || filters.dateTo) {
      searchOptions.dateRange = {
        from: filters.dateFrom,
        to: filters.dateTo
      };
    }

    if (filters.messageType) {
      searchOptions.messageType = filters.messageType;
    }

    if (filters.fileType) {
      searchOptions.fileType = filters.fileType;
    }

    if (filters.endpoint) {
      searchOptions.endpoint = filters.endpoint;
    }

    // Construct MeiliSearch filters
    const meilisearchFilters = [];
    
    if (filters.dateFrom) {
      meilisearchFilters.push(`createdAt >= ${new Date(filters.dateFrom).getTime()}`);
    }
    
    if (filters.dateTo) {
      meilisearchFilters.push(`createdAt <= ${new Date(filters.dateTo).getTime()}`);
    }
    
    if (filters.endpoint) {
      meilisearchFilters.push(`endpoint = "${filters.endpoint}"`);
    }

    if (meilisearchFilters.length > 0) {
      searchOptions.filter = meilisearchFilters.join(' AND ');
    }

    return await this.searchAll(query, searchOptions);
  }

  /**
   * Sync all search indices
   * @param {Object} options - Sync options
   * @returns {Promise<Object>} - Sync results
   */
  async syncSearchIndices(options = {}) {
    await this.initialize();

    try {
      return await databaseManager.syncSearchIndex(options);
    } catch (error) {
      logger.error('Search index sync failed:', error);
      throw error;
    }
  }

  /**
   * Get search index statistics
   * @returns {Promise<Object>} - Search statistics
   */
  async getSearchStats() {
    await this.initialize();

    try {
      return await databaseManager.getSearchStats();
    } catch (error) {
      logger.error('Get search stats failed:', error);
      throw error;
    }
  }

  /**
   * Clear search indices
   * @param {Array} collections - Collections to clear (optional)
   * @returns {Promise<Object>} - Clear results
   */
  async clearSearchIndices(collections = ['conversations', 'messages', 'files']) {
    await this.initialize();

    const results = {};

    for (const collection of collections) {
      try {
        let repo;
        switch (collection) {
          case 'conversations':
            repo = databaseManager.getRepository('conversation');
            break;
          case 'messages':
            repo = databaseManager.getRepository('message');
            break;
          case 'files':
            repo = databaseManager.getRepository('file');
            break;
          default:
            results[collection] = { error: 'Unknown collection', status: 'error' };
            continue;
        }

        if (repo && repo.searchIndexer) {
          const success = await repo.searchIndexer.clearIndex(collection);
          results[collection] = { success, status: success ? 'success' : 'error' };
        } else {
          results[collection] = { error: 'No search indexer available', status: 'error' };
        }
      } catch (error) {
        results[collection] = { error: error.message, status: 'error' };
        logger.error(`Failed to clear search index for ${collection}:`, error);
      }
    }

    return results;
  }

  /**
   * Health check for search service
   * @returns {Promise<Object>} - Health status
   */
  async healthCheck() {
    try {
      const dbHealth = await databaseManager.healthCheck();
      
      return {
        status: this.isInitialized && dbHealth.status === 'healthy' ? 'healthy' : 'unhealthy',
        isInitialized: this.isInitialized,
        database: dbHealth,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'error',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}

// Export singleton instance
const searchService = new SearchService();

module.exports = {
  SearchService,
  searchService
};
