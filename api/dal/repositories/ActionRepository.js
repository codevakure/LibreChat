const BaseRepository = require('./BaseRepository');

/**
 * Action Repository
 * Handles action-specific database operations
 */
class ActionRepository extends BaseRepository {
  getTableName() {
    return 'actions';
  }

  async findByName(name) {
    return await this.findOne({ name });
  }

  async findByType(type, options = {}) {
    return await this.findMany({ type }, options);
  }
}

module.exports = ActionRepository;
