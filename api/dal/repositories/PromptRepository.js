const BaseRepository = require('./BaseRepository');

/**
 * Prompt Repository
 * Handles prompt/template-specific database operations
 */
class PromptRepository extends BaseRepository {
  getTableName() {
    return 'prompts';
  }

  async findByTitle(title) {
    return await this.findOne({ title });
  }

  async findByUserId(userId, options = {}) {
    return await this.findMany({ author: userId }, options);
  }

  async findPublic(options = {}) {
    return await this.findMany({ isPublic: true }, options);
  }
}

module.exports = PromptRepository;
