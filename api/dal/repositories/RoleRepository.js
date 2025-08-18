const BaseRepository = require('./BaseRepository');

/**
 * Role Repository
 * Handles user role-specific database operations
 */
class RoleRepository extends BaseRepository {
  getTableName() {
    return 'roles';
  }

  async findByName(name) {
    return await this.findOne({ name });
  }
}

module.exports = RoleRepository;
