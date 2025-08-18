const BaseRepository = require('./BaseRepository');

/**
 * Session Repository
 * Handles user session-specific database operations
 */
class SessionRepository extends BaseRepository {
  getTableName() {
    return 'sessions';
  }

  async findByUserId(userId, options = {}) {
    return await this.findMany({ user: userId }, options);
  }

  async findBySessionId(sessionId) {
    return await this.findOne({ sessionId });
  }
}

module.exports = SessionRepository;
