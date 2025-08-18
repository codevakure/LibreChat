const BaseRepository = require('./BaseRepository');

/**
 * Preset Repository
 * Handles conversation preset-specific database operations
 */
class PresetRepository extends BaseRepository {
  getTableName() {
    return 'presets';
  }

  async findByUserId(userId, options = {}) {
    return await this.findMany({ user: userId }, options);
  }

  async findByTitle(title, options = {}) {
    const regex = new RegExp(title, 'i');
    return await this.findMany({ title: regex }, options);
  }
}

module.exports = PresetRepository;
