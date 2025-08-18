const BaseRepository = require('./BaseRepository');

/**
 * Permission Repository
 * Handles permission-specific database operations
 */
class PermissionRepository extends BaseRepository {
  getTableName() {
    return 'permissions';
  }

  async findByName(name) {
    return await this.findOne({ name });
  }

  async findByRole(roleId, options = {}) {
    return await this.findMany({ role: roleId }, options);
  }
}

module.exports = PermissionRepository;
