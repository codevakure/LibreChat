const BaseRepository = require('./BaseRepository');

/**
 * Message Repository
 * Handles message-specific database operations
 */
class MessageRepository extends BaseRepository {
  /**
   * Get the table/collection name
   * @returns {string}
   */
  getTableName() {
    return 'messages';
  }

  /**
   * Validate message data
   * @param {Object} data - Message data to validate
   * @param {string} operation - Operation type
   * @returns {Object} - Validated data
   */
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
   * Search messages by text content
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
        text: { $search: searchTerm } // PostgreSQL adapter would need to handle this
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
   * Mark message as edited
   * @param {string} messageId - Message ID
   * @param {string} newText - New message text
   * @returns {Promise<Object|null>}
   */
  async markAsEdited(messageId, newText) {
    if (!messageId || !newText) {
      throw new Error('Message ID and new text are required');
    }
    
    return await this.updateById(messageId, {
      text: newText,
      isEdited: true,
      editedAt: new Date()
    });
  }
}

module.exports = MessageRepository;
