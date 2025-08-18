const BaseRepository = require('./BaseRepository');

/**
 * Agent Repository
 * Handles AI agent-specific database operations
 */
class AgentRepository extends BaseRepository {
  getTableName() {
    return 'agents';
  }

  validateData(data, operation = 'create') {
    const validated = super.validateData(data, operation);
    
    if (operation === 'create') {
      if (!validated.name) {
        throw new Error('Agent name is required');
      }
    }
    
    return validated;
  }

  async findByName(name) {
    return await this.findOne({ name });
  }

  async findByUserId(userId, options = {}) {
    return await this.findMany({ author: userId }, options);
  }

  async findPublic(options = {}) {
    return await this.findMany({ isPublic: true }, options);
  }
}

module.exports = AgentRepository;
