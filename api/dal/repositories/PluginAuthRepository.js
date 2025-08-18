const BaseRepository = require('./BaseRepository');

/**
 * Plugin Auth Repository
 * Handles plugin authentication-specific database operations
 */
class PluginAuthRepository extends BaseRepository {
  getTableName() {
    return 'plugin_auths';
  }

  async findByUserId(userId, options = {}) {
    return await this.findMany({ user: userId }, options);
  }

  async findByPlugin(pluginKey, options = {}) {
    return await this.findMany({ pluginKey }, options);
  }
}

module.exports = PluginAuthRepository;
