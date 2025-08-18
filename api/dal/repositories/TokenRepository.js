// TokenRepository.js - Authentication token management repository
const BaseRepository = require('./BaseRepository');

class TokenRepository extends BaseRepository {
  constructor(adapter) {
    super(adapter, 'tokens');
  }

  /**
   * Find token by token value
   * @param {string} token - Token value
   * @returns {Promise<Object|null>}
   */
  async findByToken(token) {
    try {
      return await this.adapter.findOne(this.collection, { token });
    } catch (error) {
      throw new Error(`Failed to find token: ${error.message}`);
    }
  }

  /**
   * Find tokens by user
   * @param {string} user - User ID
   * @returns {Promise<Array>}
   */
  async findByUser(user) {
    try {
      return await this.adapter.find(this.collection, { user });
    } catch (error) {
      throw new Error(`Failed to find tokens by user: ${error.message}`);
    }
  }

  /**
   * Find tokens by type
   * @param {string} type - Token type
   * @returns {Promise<Array>}
   */
  async findByType(type) {
    try {
      return await this.adapter.find(this.collection, { type });
    } catch (error) {
      throw new Error(`Failed to find tokens by type: ${error.message}`);
    }
  }

  /**
   * Find expired tokens
   * @returns {Promise<Array>}
   */
  async findExpired() {
    try {
      const now = new Date();
      return await this.adapter.find(this.collection, { 
        expires_at: { $lt: now } 
      });
    } catch (error) {
      throw new Error(`Failed to find expired tokens: ${error.message}`);
    }
  }

  /**
   * Find valid tokens by user and type
   * @param {string} user - User ID
   * @param {string} type - Token type
   * @returns {Promise<Array>}
   */
  async findValidByUserAndType(user, type) {
    try {
      const now = new Date();
      return await this.adapter.find(this.collection, { 
        user,
        type,
        $or: [
          { expires_at: { $gt: now } },
          { expires_at: null }
        ]
      });
    } catch (error) {
      throw new Error(`Failed to find valid tokens: ${error.message}`);
    }
  }

  /**
   * Delete expired tokens
   * @returns {Promise<number>} Number of deleted tokens
   */
  async deleteExpired() {
    try {
      const now = new Date();
      const result = await this.adapter.deleteMany(this.collection, { 
        expires_at: { $lt: now } 
      });
      return result.deletedCount || 0;
    } catch (error) {
      throw new Error(`Failed to delete expired tokens: ${error.message}`);
    }
  }

  /**
   * Validate token data
   * @param {Object} data - Token data to validate
   * @returns {Object} Validated data
   */
  validateData(data) {
    const errors = [];

    // User validation
    if (!data.user || typeof data.user !== 'string') {
      errors.push('User is required and must be a string');
    }

    // Token validation
    if (!data.token || typeof data.token !== 'string') {
      errors.push('Token is required and must be a string');
    }

    // Type validation
    if (!data.type || typeof data.type !== 'string') {
      errors.push('Type is required and must be a string');
    }

    // Expires at validation
    if (data.expires_at && !(data.expires_at instanceof Date)) {
      errors.push('Expires at must be a Date object');
    }

    if (errors.length > 0) {
      throw new Error(`Validation failed: ${errors.join(', ')}`);
    }

    return {
      ...data,
      created_at: data.created_at || new Date()
    };
  }
}

module.exports = TokenRepository;
