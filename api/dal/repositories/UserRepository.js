const BaseRepository = require('./BaseRepository');

/**
 * User Repository
 * Handles user-specific database operations
 */
class UserRepository extends BaseRepository {
  /**
   * Get the table/collection name
   * @returns {string}
   */
  getTableName() {
    return 'users';
  }

  /**
   * Validate user data
   * @param {Object} data - User data to validate
   * @param {string} operation - Operation type
   * @returns {Object} - Validated data
   */
  validateData(data, operation = 'create') {
    const validated = super.validateData(data, operation);
    
    if (operation === 'create') {
      if (!validated.email) {
        throw new Error('Email is required for user creation');
      }
      
      if (!validated.username && !validated.name) {
        throw new Error('Username or name is required for user creation');
      }
    }
    
    return validated;
  }

  /**
   * Find user by email
   * @param {string} email - User email
   * @returns {Promise<Object|null>}
   */
  async findByEmail(email) {
    if (!email) {
      throw new Error('Email is required');
    }
    
    return await this.findOne({ email: email.toLowerCase() });
  }

  /**
   * Find user by username
   * @param {string} username - Username
   * @returns {Promise<Object|null>}
   */
  async findByUsername(username) {
    if (!username) {
      throw new Error('Username is required');
    }
    
    return await this.findOne({ username });
  }

  /**
   * Check if email exists
   * @param {string} email - Email to check
   * @param {string} excludeUserId - User ID to exclude from check
   * @returns {Promise<boolean>}
   */
  async emailExists(email, excludeUserId = null) {
    if (!email) {
      throw new Error('Email is required');
    }
    
    const query = { email: email.toLowerCase() };
    
    if (excludeUserId) {
      // For MongoDB, use _id; for PostgreSQL, use id
      if (this.adapter.getType() === 'mongodb') {
        query._id = { $ne: excludeUserId };
      } else {
        query.id = { $ne: excludeUserId }; // Note: PostgreSQL adapter needs to handle $ne
      }
    }
    
    return await this.exists(query);
  }

  /**
   * Check if username exists
   * @param {string} username - Username to check
   * @param {string} excludeUserId - User ID to exclude from check
   * @returns {Promise<boolean>}
   */
  async usernameExists(username, excludeUserId = null) {
    if (!username) {
      throw new Error('Username is required');
    }
    
    const query = { username };
    
    if (excludeUserId) {
      // For MongoDB, use _id; for PostgreSQL, use id
      if (this.adapter.getType() === 'mongodb') {
        query._id = { $ne: excludeUserId };
      } else {
        query.id = { $ne: excludeUserId }; // Note: PostgreSQL adapter needs to handle $ne
      }
    }
    
    return await this.exists(query);
  }

  /**
   * Update user last login
   * @param {string} userId - User ID
   * @returns {Promise<Object|null>}
   */
  async updateLastLogin(userId) {
    return await this.updateById(userId, {
      lastLogin: new Date()
    });
  }

  /**
   * Get users by role
   * @param {string} role - User role
   * @param {Object} options - Query options
   * @returns {Promise<Array>}
   */
  async findByRole(role, options = {}) {
    return await this.findMany({ role }, options);
  }

  /**
   * Get active users (not banned/deleted)
   * @param {Object} options - Query options
   * @returns {Promise<Array>}
   */
  async findActive(options = {}) {
    const query = {
      $and: [
        { $or: [{ banned: { $exists: false } }, { banned: false }] },
        { $or: [{ deleted: { $exists: false } }, { deleted: false }] }
      ]
    };
    
    // For PostgreSQL, we'd need to adjust this query
    if (this.adapter.getType() === 'postgresql') {
      // Simplified query for PostgreSQL (adapter would need to handle this)
      return await this.findMany({ banned: false, deleted: false }, options);
    }
    
    return await this.findMany(query, options);
  }

  /**
   * Search users by email or username
   * @param {string} searchTerm - Search term
   * @param {Object} options - Query options
   * @returns {Promise<Array>}
   */
  async search(searchTerm, options = {}) {
    if (!searchTerm) {
      return [];
    }
    
    const regex = new RegExp(searchTerm, 'i');
    
    if (this.adapter.getType() === 'mongodb') {
      const query = {
        $or: [
          { email: regex },
          { username: regex },
          { name: regex }
        ]
      };
      return await this.findMany(query, options);
    } else {
      // For PostgreSQL, we'd use ILIKE
      // This would need proper implementation in the PostgreSQL adapter
      const query = {
        $or: [
          { email: { $ilike: `%${searchTerm}%` } },
          { username: { $ilike: `%${searchTerm}%` } },
          { name: { $ilike: `%${searchTerm}%` } }
        ]
      };
      return await this.findMany(query, options);
    }
  }

  /**
   * Transform data before saving
   * @param {Object} data - Data to transform
   * @param {string} operation - Operation type
   * @returns {Object} - Transformed data
   */
  transformDataForSave(data, operation = 'create') {
    const transformed = super.transformDataForSave(data, operation);
    
    // Normalize email to lowercase
    if (transformed.email) {
      transformed.email = transformed.email.toLowerCase();
    }
    
    return transformed;
  }
}

module.exports = UserRepository;
