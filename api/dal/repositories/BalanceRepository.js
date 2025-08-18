const BaseRepository = require('./BaseRepository');

/**
 * Balance Repository
 * Handles user balance/credits-specific database operations
 */
class BalanceRepository extends BaseRepository {
  getTableName() {
    return 'balances';
  }

  async findByUserId(userId) {
    return await this.findOne({ user: userId });
  }

  async updateBalance(userId, amount) {
    return await this.updateById(userId, { balance: amount });
  }
}

module.exports = BalanceRepository;
