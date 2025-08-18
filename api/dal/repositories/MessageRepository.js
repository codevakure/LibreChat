const BaseRepository = require('./BaseRepository');
const SearchIndexer = require('../plugins/SearchIndexer');

/**
 * Message Repository
 * Handles message-specific database operations with search integration
 */
class MessageRepository extends BaseRepository {
  constructor(adapter, config = {}) {
    super(adapter);
    this.searchIndexer = new SearchIndexer(adapter, config.search);
  }
  /**
   * Get the table/collection name
   * @returns {string}
   */
  getTableName() {
    return 'messages';
  }

  /**
   * Create a new message with search indexing
   * @param {Object} data - Message data
   * @returns {Promise<Object>} - Created message
   */
  async create(data) {
    const message = await super.create(data);
    
    // Index the message for search (don't fail if indexing fails)
    if (message) {
      try {
        await this.searchIndexer.indexDocument('messages', message);
      } catch (error) {
        console.warn('Failed to index message for search:', error.message);
      }
    }
    
    return message;
  }

  /**
   * Update a message with search re-indexing
   * @param {string} id - Message ID
   * @param {Object} data - Update data
   * @returns {Promise<Object|null>} - Updated message
   */
  async updateById(id, data) {
    const message = await super.updateById(id, data);
    
    // Re-index the updated message (don't fail if indexing fails)
    if (message) {
      try {
        await this.searchIndexer.updateDocument('messages', message);
      } catch (error) {
        console.warn('Failed to update message in search index:', error.message);
      }
    }
    
    return message;
  }

  /**
   * Delete a message with search index cleanup
   * @param {string} id - Message ID
   * @returns {Promise<boolean>} - Success status
   */
  async deleteById(id) {
    const success = await super.deleteById(id);
    
    // Remove from search index (don't fail if indexing fails)
    if (success) {
      try {
        await this.searchIndexer.deleteDocument('messages', id);
      } catch (error) {
        console.warn('Failed to remove message from search index:', error.message);
      }
    }
    
    return success;
  }
  validateData(data, operation = 'create') {
    const validated = super.validateData(data, operation);
    
    if (operation === 'create') {
      if (!validated.conversationId) {
        throw new Error('Conversation ID is required for message creation');
      }
      
      if (!validated.text && !validated.content) {
        throw new Error('Message text or content is required');
      }
    }
    
    return validated;
  }

  /**
   * Find messages by conversation ID
   * @param {string} conversationId - Conversation ID
   * @param {Object} options - Query options
   * @returns {Promise<Array>}
   */
  async findByConversationId(conversationId, options = {}) {
    if (!conversationId) {
      throw new Error('Conversation ID is required');
    }
    
    const defaultOptions = {
      sort: { createdAt: 1 }, // Order by creation time
      ...options
    };
    
    return await this.findMany({ conversationId }, defaultOptions);
  }

  /**
   * Find messages by user ID
   * @param {string} userId - User ID
   * @param {Object} options - Query options
   * @returns {Promise<Array>}
   */
  async findByUserId(userId, options = {}) {
    if (!userId) {
      throw new Error('User ID is required');
    }
    
    return await this.findMany({ user: userId }, options);
  }

  /**
   * Find messages by parent message ID (for threaded conversations)
   * @param {string} parentMessageId - Parent message ID
   * @param {Object} options - Query options
   * @returns {Promise<Array>}
   */
  async findByParentId(parentMessageId, options = {}) {
    if (!parentMessageId) {
      throw new Error('Parent message ID is required');
    }
    
    return await this.findMany({ parentMessageId }, options);
  }

  /**
   * Get latest messages for a conversation
   * @param {string} conversationId - Conversation ID
   * @param {number} limit - Number of messages to retrieve
   * @returns {Promise<Array>}
   */
  async getLatestByConversationId(conversationId, limit = 50) {
    if (!conversationId) {
      throw new Error('Conversation ID is required');
    }
    
    return await this.findMany(
      { conversationId },
      {
        sort: { createdAt: -1 }, // Most recent first
        limit
      }
    );
  }

  /**
   * Count messages in a conversation
   * @param {string} conversationId - Conversation ID
   * @returns {Promise<number>}
   */
  async countByConversationId(conversationId) {
    if (!conversationId) {
      throw new Error('Conversation ID is required');
    }
    
    return await this.count({ conversationId });
  }

  /**
   * Delete all messages in a conversation
   * @param {string} conversationId - Conversation ID
   * @returns {Promise<Object>} - Delete result
   */
  async deleteByConversationId(conversationId) {
    if (!conversationId) {
      throw new Error('Conversation ID is required');
    }
    
    return await this.deleteMany({ conversationId });
  }

  /**
   * Find messages with files/attachments
   * @param {string} conversationId - Conversation ID (optional)
   * @param {Object} options - Query options
   * @returns {Promise<Array>}
   */
  async findWithFiles(conversationId = null, options = {}) {
    const query = {
      files: { $exists: true, $ne: [], $not: { $size: 0 } }
    };
    
    if (conversationId) {
      query.conversationId = conversationId;
    }
    
    return await this.findMany(query, options);
  }

  /**
   * Search messages using MeiliSearch with fallback to database search
   * @param {string} searchTerm - Search term
   * @param {Object} options - Search options
   * @returns {Promise<Array>} - Search results
   */
  async searchMessages(searchTerm, options = {}) {
    if (!searchTerm) {
      return [];
    }

    // Try MeiliSearch first if available
    if (this.searchIndexer.isEnabled()) {
      try {
        const searchResult = await this.searchIndexer.search('messages', searchTerm, {
          filter: options.filter,
          limit: options.limit || 20,
          offset: options.offset || 0,
          attributesToHighlight: ['text', 'content']
        });

        if (searchResult && searchResult.hits) {
          // Get full message objects from database
          const messageIds = searchResult.hits.map(hit => hit.id);
          const messages = await this.findMany({ _id: { $in: messageIds } });
          
          // Preserve search ranking order
          const messageMap = new Map(messages.map(msg => [msg._id || msg.id, msg]));
          return searchResult.hits
            .map(hit => messageMap.get(hit.id))
            .filter(Boolean);
        }
      } catch (error) {
        console.warn('MeiliSearch failed, falling back to database search:', error.message);
      }
    }

    // Fallback to database search
    return await this.searchByText(searchTerm, options.conversationId, options);
  }

  /**
   * Search messages by text content (database fallback)
   * @param {string} searchTerm - Search term
   * @param {string} conversationId - Conversation ID (optional)
   * @param {Object} options - Query options
   * @returns {Promise<Array>}
   */
  async searchByText(searchTerm, conversationId = null, options = {}) {
    if (!searchTerm) {
      return [];
    }
    
    let query;
    
    if (this.adapter.getType() === 'mongodb') {
      query = {
        $text: { $search: searchTerm }
      };
    } else {
      // PostgreSQL full-text search
      query = {
        text: { $search: searchTerm } // PostgreSQL adapter handles this
      };
    }
    
    if (conversationId) {
      query.conversationId = conversationId;
    }
    
    return await this.findMany(query, options);
  }

  /**
   * Get message statistics for a conversation
   * @param {string} conversationId - Conversation ID
   * @returns {Promise<Object>} - Statistics object
   */
  async getConversationStats(conversationId) {
    if (!conversationId) {
      throw new Error('Conversation ID is required');
    }
    
    const pipeline = [
      { $match: { conversationId } },
      {
        $group: {
          _id: null,
          totalMessages: { $sum: 1 },
          totalTokens: { $sum: '$tokenCount' },
          uniqueUsers: { $addToSet: '$user' },
          firstMessage: { $min: '$createdAt' },
          lastMessage: { $max: '$createdAt' }
        }
      },
      {
        $project: {
          _id: 0,
          totalMessages: 1,
          totalTokens: 1,
          uniqueUserCount: { $size: '$uniqueUsers' },
          firstMessage: 1,
          lastMessage: 1
        }
      }
    ];
    
    const results = await this.aggregate(pipeline);
    return results.length > 0 ? results[0] : {
      totalMessages: 0,
      totalTokens: 0,
      uniqueUserCount: 0,
      firstMessage: null,
      lastMessage: null
    };
  }

  /**
   * Update message token count
   * @param {string} messageId - Message ID
   * @param {number} tokenCount - Token count
   * @returns {Promise<Object|null>}
   */
  async updateTokenCount(messageId, tokenCount) {
    if (!messageId || typeof tokenCount !== 'number') {
      throw new Error('Message ID and valid token count are required');
    }
    
    return await this.updateById(messageId, { tokenCount });
  }

  /**
   * Mark message as edited with search re-indexing
   * @param {string} messageId - Message ID
   * @param {string} newText - New message text
   * @returns {Promise<Object|null>}
   */
  async markAsEdited(messageId, newText) {
    if (!messageId || !newText) {
      throw new Error('Message ID and new text are required');
    }
    
    const message = await this.updateById(messageId, {
      text: newText,
      isEdited: true,
      editedAt: new Date()
    });
    
    // Re-index the edited message
    if (message) {
      await this.searchIndexer.updateDocument('messages', message);
    }
    
    return message;
  }

  /**
   * Sync messages with search index
   * @param {Object} options - Sync options
   * @returns {Promise<number>} - Number of messages indexed
   */
  async syncSearchIndex(options = {}) {
    return await this.searchIndexer.syncCollection('messages', options);
  }

  /**
   * Get search index statistics for messages
   * @returns {Promise<Object|null>} - Index stats
   */
  async getSearchStats() {
    return await this.searchIndexer.getIndexStats('messages');
  }
}

module.exports = MessageRepository;
