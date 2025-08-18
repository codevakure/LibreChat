const BaseRepository = require('./BaseRepository');

/**
 * Key Repository
 * Handles API key-specific database operations
 */
class KeyRepository extends BaseRepository {
  getTableName() {
    return 'keys';
  }

  async findByUserId(userId, options = {}) {
    return await this.findMany({ user: userId }, options);
  }

  async findByName(name) {
    return await this.findOne({ name });
  }
}

module.exports = KeyRepository;
