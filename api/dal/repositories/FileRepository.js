const BaseRepository = require('./BaseRepository');

/**
 * File Repository
 * Handles file-specific database operations
 */
class FileRepository extends BaseRepository {
  getTableName() {
    return 'files';
  }

  validateData(data, operation = 'create') {
    const validated = super.validateData(data, operation);
    
    if (operation === 'create') {
      if (!validated.filename) {
        throw new Error('Filename is required');
      }
    }
    
    return validated;
  }

  async findByUserId(userId, options = {}) {
    return await this.findMany({ user: userId }, options);
  }

  async findByConversationId(conversationId, options = {}) {
    return await this.findMany({ conversationId }, options);
  }

  async findByType(type, options = {}) {
    return await this.findMany({ type }, options);
  }
}

module.exports = FileRepository;
