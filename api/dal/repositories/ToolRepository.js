const BaseRepository = require('./BaseRepository');

/**
 * Tool Repository
 * Handles tool-specific database operations
 */
class ToolRepository extends BaseRepository {
  getTableName() {
    return 'tools';
  }

  async findByName(name) {
    return await this.findOne({ name });
  }

  async findByType(type, options = {}) {
    return await this.findMany({ type }, options);
  }
}

module.exports = ToolRepository;
