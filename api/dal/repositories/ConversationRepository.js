const BaseRepository = require('./BaseRepository');

/**
 * Conversation Repository
 * Handles conversation-specific database operations
 */
class ConversationRepository extends BaseRepository {
  /**
   * Get the table/collection name
   * @returns {string}
   */
  getTableName() {
    return 'conversations';
  }

  /**
   * Validate conversation data
   * @param {Object} data - Conversation data to validate
   * @param {string} operation - Operation type
   * @returns {Object} - Validated data
   */
  validateData(data, operation = 'create') {
    const validated = super.validateData(data, operation);
    
    if (operation === 'create') {
      if (!validated.user) {
        throw new Error('User ID is required for conversation creation');
      }
    }
    
    return validated;
  }

  /**
   * Find conversations by user ID
   * @param {string} userId - User ID
   * @param {Object} options - Query options
   * @returns {Promise<Array>}
   */
  async findByUserId(userId, options = {}) {
    if (!userId) {
      throw new Error('User ID is required');
    }
    
    const defaultOptions = {
      sort: { updatedAt: -1 }, // Most recently updated first
      ...options
    };
    
    return await this.findMany({ user: userId }, defaultOptions);
  }

  /**
   * Find conversations by title (search)
   * @param {string} title - Title search term
   * @param {string} userId - User ID (optional)
   * @param {Object} options - Query options
   * @returns {Promise<Array>}
   */
  async findByTitle(title, userId = null, options = {}) {
    if (!title) {
      return [];
    }
    
    const regex = new RegExp(title, 'i');
    const query = { title: regex };
    
    if (userId) {
      query.user = userId;
    }
    
    return await this.findMany(query, options);
  }

  /**
   * Get user's recent conversations
   * @param {string} userId - User ID
   * @param {number} limit - Number of conversations to retrieve
   * @returns {Promise<Array>}
   */
  async getRecentByUserId(userId, limit = 20) {
    if (!userId) {
      throw new Error('User ID is required');
    }
    
    return await this.findMany(
      { user: userId },
      {
        sort: { updatedAt: -1 },
        limit
      }
    );
  }

  /**
   * Count conversations by user
   * @param {string} userId - User ID
   * @returns {Promise<number>}
   */
  async countByUserId(userId) {
    if (!userId) {
      throw new Error('User ID is required');
    }
    
    return await this.count({ user: userId });
  }

  /**
   * Update conversation title
   * @param {string} conversationId - Conversation ID
   * @param {string} title - New title
   * @returns {Promise<Object|null>}
   */
  async updateTitle(conversationId, title) {
    if (!conversationId || !title) {
      throw new Error('Conversation ID and title are required');
    }
    
    return await this.updateById(conversationId, { title });
  }

  /**
   * Update conversation last activity
   * @param {string} conversationId - Conversation ID
   * @returns {Promise<Object|null>}
   */
  async updateLastActivity(conversationId) {
    if (!conversationId) {
      throw new Error('Conversation ID is required');
    }
    
    return await this.updateById(conversationId, {
      updatedAt: new Date()
    });
  }

  /**
   * Archive/unarchive conversation
   * @param {string} conversationId - Conversation ID
   * @param {boolean} archived - Archive status
   * @returns {Promise<Object|null>}
   */
  async setArchived(conversationId, archived = true) {
    if (!conversationId) {
      throw new Error('Conversation ID is required');
    }
    
    return await this.updateById(conversationId, { 
      archived,
      archivedAt: archived ? new Date() : null
    });
  }

  /**
   * Pin/unpin conversation
   * @param {string} conversationId - Conversation ID
   * @param {boolean} pinned - Pin status
   * @returns {Promise<Object|null>}
   */
  async setPinned(conversationId, pinned = true) {
    if (!conversationId) {
      throw new Error('Conversation ID is required');
    }
    
    return await this.updateById(conversationId, { 
      pinned,
      pinnedAt: pinned ? new Date() : null
    });
  }

  /**
   * Get pinned conversations for user
   * @param {string} userId - User ID
   * @param {Object} options - Query options
   * @returns {Promise<Array>}
   */
  async getPinnedByUserId(userId, options = {}) {
    if (!userId) {
      throw new Error('User ID is required');
    }
    
    const defaultOptions = {
      sort: { pinnedAt: -1 },
      ...options
    };
    
    return await this.findMany(
      { user: userId, pinned: true },
      defaultOptions
    );
  }

  /**
   * Get archived conversations for user
   * @param {string} userId - User ID
   * @param {Object} options - Query options
   * @returns {Promise<Array>}
   */
  async getArchivedByUserId(userId, options = {}) {
    if (!userId) {
      throw new Error('User ID is required');
    }
    
    const defaultOptions = {
      sort: { archivedAt: -1 },
      ...options
    };
    
    return await this.findMany(
      { user: userId, archived: true },
      defaultOptions
    );
  }

  /**
   * Get active (non-archived) conversations for user
   * @param {string} userId - User ID
   * @param {Object} options - Query options
   * @returns {Promise<Array>}
   */
  async getActiveByUserId(userId, options = {}) {
    if (!userId) {
      throw new Error('User ID is required');
    }
    
    const defaultOptions = {
      sort: { updatedAt: -1 },
      ...options
    };
    
    const query = {
      user: userId,
      $or: [
        { archived: { $exists: false } },
        { archived: false }
      ]
    };
    
    return await this.findMany(query, defaultOptions);
  }

  /**
   * Search conversations by user
   * @param {string} userId - User ID
   * @param {string} searchTerm - Search term
   * @param {Object} options - Query options
   * @returns {Promise<Array>}
   */
  async searchByUser(userId, searchTerm, options = {}) {
    if (!userId || !searchTerm) {
      throw new Error('User ID and search term are required');
    }
    
    const regex = new RegExp(searchTerm, 'i');
    const query = {
      user: userId,
      $or: [
        { title: regex },
        { tags: regex }
      ]
    };
    
    return await this.findMany(query, options);
  }

  /**
   * Add tags to conversation
   * @param {string} conversationId - Conversation ID
   * @param {Array} tags - Tags to add
   * @returns {Promise<Object|null>}
   */
  async addTags(conversationId, tags) {
    if (!conversationId || !Array.isArray(tags)) {
      throw new Error('Conversation ID and tags array are required');
    }
    
    if (this.adapter.getType() === 'mongodb') {
      return await this.updateById(conversationId, {
        $addToSet: { tags: { $each: tags } }
      });
    } else {
      // For PostgreSQL, we'd need to handle array operations differently
      const conversation = await this.findById(conversationId);
      if (!conversation) return null;
      
      const existingTags = conversation.tags || [];
      const newTags = [...new Set([...existingTags, ...tags])];
      
      return await this.updateById(conversationId, { tags: newTags });
    }
  }

  /**
   * Remove tags from conversation
   * @param {string} conversationId - Conversation ID
   * @param {Array} tags - Tags to remove
   * @returns {Promise<Object|null>}
   */
  async removeTags(conversationId, tags) {
    if (!conversationId || !Array.isArray(tags)) {
      throw new Error('Conversation ID and tags array are required');
    }
    
    if (this.adapter.getType() === 'mongodb') {
      return await this.updateById(conversationId, {
        $pullAll: { tags }
      });
    } else {
      // For PostgreSQL, we'd need to handle array operations differently
      const conversation = await this.findById(conversationId);
      if (!conversation) return null;
      
      const existingTags = conversation.tags || [];
      const newTags = existingTags.filter(tag => !tags.includes(tag));
      
      return await this.updateById(conversationId, { tags: newTags });
    }
  }

  /**
   * Get conversation statistics for user
   * @param {string} userId - User ID
   * @returns {Promise<Object>} - Statistics object
   */
  async getUserStats(userId) {
    if (!userId) {
      throw new Error('User ID is required');
    }
    
    const pipeline = [
      { $match: { user: userId } },
      {
        $group: {
          _id: null,
          totalConversations: { $sum: 1 },
          pinnedCount: {
            $sum: { $cond: [{ $eq: ['$pinned', true] }, 1, 0] }
          },
          archivedCount: {
            $sum: { $cond: [{ $eq: ['$archived', true] }, 1, 0] }
          },
          oldestConversation: { $min: '$createdAt' },
          newestConversation: { $max: '$updatedAt' }
        }
      },
      {
        $project: {
          _id: 0,
          totalConversations: 1,
          pinnedCount: 1,
          archivedCount: 1,
          activeCount: { $subtract: ['$totalConversations', '$archivedCount'] },
          oldestConversation: 1,
          newestConversation: 1
        }
      }
    ];
    
    const results = await this.aggregate(pipeline);
    return results.length > 0 ? results[0] : {
      totalConversations: 0,
      pinnedCount: 0,
      archivedCount: 0,
      activeCount: 0,
      oldestConversation: null,
      newestConversation: null
    };
  }
}

module.exports = ConversationRepository;
