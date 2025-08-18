// SharedLinkRepository.js - Shared conversation link management repository
const BaseRepository = require('./BaseRepository');

class SharedLinkRepository extends BaseRepository {
  constructor(adapter) {
    super(adapter, 'shared_links');
  }

  /**
   * Find shared link by share ID
   * @param {string} shareId - Share ID
   * @returns {Promise<Object|null>}
   */
  async findByShareId(shareId) {
    try {
      return await this.adapter.findOne(this.collection, { share_id: shareId });
    } catch (error) {
      throw new Error(`Failed to find shared link by share ID: ${error.message}`);
    }
  }

  /**
   * Find shared links by user
   * @param {string} user - User ID
   * @returns {Promise<Array>}
   */
  async findByUser(user) {
    try {
      return await this.adapter.find(this.collection, { user });
    } catch (error) {
      throw new Error(`Failed to find shared links by user: ${error.message}`);
    }
  }

  /**
   * Find shared links by conversation
   * @param {string} conversationId - Conversation ID
   * @returns {Promise<Array>}
   */
  async findByConversation(conversationId) {
    try {
      return await this.adapter.find(this.collection, { conversation_id: conversationId });
    } catch (error) {
      throw new Error(`Failed to find shared links by conversation: ${error.message}`);
    }
  }

  /**
   * Find public shared links
   * @returns {Promise<Array>}
   */
  async findPublic() {
    try {
      return await this.adapter.find(this.collection, { is_public: true });
    } catch (error) {
      throw new Error(`Failed to find public shared links: ${error.message}`);
    }
  }

  /**
   * Update link publicity
   * @param {string} id - Link ID
   * @param {boolean} isPublic - Public status
   * @returns {Promise<Object|null>}
   */
  async updatePublicity(id, isPublic) {
    try {
      return await this.adapter.updateOne(
        this.collection,
        { [this.adapter.getIdField()]: id },
        { is_public: isPublic, updated_at: new Date() }
      );
    } catch (error) {
      throw new Error(`Failed to update shared link publicity: ${error.message}`);
    }
  }

  /**
   * Validate shared link data
   * @param {Object} data - Shared link data to validate
   * @returns {Object} Validated data
   */
  validateData(data) {
    const errors = [];

    // Share ID validation
    if (!data.share_id || typeof data.share_id !== 'string') {
      errors.push('Share ID is required and must be a string');
    }

    // Conversation ID validation
    if (!data.conversation_id || typeof data.conversation_id !== 'string') {
      errors.push('Conversation ID is required and must be a string');
    }

    // User validation
    if (!data.user || typeof data.user !== 'string') {
      errors.push('User is required and must be a string');
    }

    // Title validation
    if (data.title && (typeof data.title !== 'string' || data.title.length > 500)) {
      errors.push('Title must be a string with maximum 500 characters');
    }

    if (errors.length > 0) {
      throw new Error(`Validation failed: ${errors.join(', ')}`);
    }

    return {
      ...data,
      is_public: data.is_public || false,
      updated_at: new Date()
    };
  }
}

module.exports = SharedLinkRepository;
