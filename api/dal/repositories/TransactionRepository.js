// TransactionRepository.js - Financial transaction management repository
const BaseRepository = require('./BaseRepository');

class TransactionRepository extends BaseRepository {
  constructor(adapter) {
    super(adapter, 'transactions');
  }

  /**
   * Find transactions by user
   * @param {string} user - User ID
   * @returns {Promise<Array>}
   */
  async findByUser(user) {
    try {
      return await this.adapter.find(this.collection, { user }, { created_at: -1 });
    } catch (error) {
      throw new Error(`Failed to find transactions by user: ${error.message}`);
    }
  }

  /**
   * Find transactions by type
   * @param {string} type - Transaction type
   * @returns {Promise<Array>}
   */
  async findByType(type) {
    try {
      return await this.adapter.find(this.collection, { type }, { created_at: -1 });
    } catch (error) {
      throw new Error(`Failed to find transactions by type: ${error.message}`);
    }
  }

  /**
   * Find transactions by user and type
   * @param {string} user - User ID
   * @param {string} type - Transaction type
   * @returns {Promise<Array>}
   */
  async findByUserAndType(user, type) {
    try {
      return await this.adapter.find(this.collection, { user, type }, { created_at: -1 });
    } catch (error) {
      throw new Error(`Failed to find transactions by user and type: ${error.message}`);
    }
  }

  /**
   * Calculate user balance
   * @param {string} user - User ID
   * @returns {Promise<number>}
   */
  async calculateUserBalance(user) {
    try {
      const transactions = await this.adapter.find(this.collection, { user });
      return transactions.reduce((balance, transaction) => {
        const amount = parseFloat(transaction.amount);
        return transaction.type === 'credit' ? balance + amount : balance - amount;
      }, 0);
    } catch (error) {
      throw new Error(`Failed to calculate user balance: ${error.message}`);
    }
  }

  /**
   * Find transactions in date range
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @returns {Promise<Array>}
   */
  async findInDateRange(startDate, endDate) {
    try {
      return await this.adapter.find(this.collection, { 
        created_at: { 
          $gte: startDate, 
          $lte: endDate 
        } 
      }, { created_at: -1 });
    } catch (error) {
      throw new Error(`Failed to find transactions in date range: ${error.message}`);
    }
  }

  /**
   * Get transaction summary by user
   * @param {string} user - User ID
   * @returns {Promise<Object>}
   */
  async getTransactionSummary(user) {
    try {
      const transactions = await this.adapter.find(this.collection, { user });
      const summary = {
        totalCredits: 0,
        totalDebits: 0,
        transactionCount: transactions.length,
        lastTransaction: null
      };

      transactions.forEach(transaction => {
        const amount = parseFloat(transaction.amount);
        if (transaction.type === 'credit') {
          summary.totalCredits += amount;
        } else {
          summary.totalDebits += amount;
        }

        if (!summary.lastTransaction || 
            new Date(transaction.created_at) > new Date(summary.lastTransaction.created_at)) {
          summary.lastTransaction = transaction;
        }
      });

      summary.balance = summary.totalCredits - summary.totalDebits;
      return summary;
    } catch (error) {
      throw new Error(`Failed to get transaction summary: ${error.message}`);
    }
  }

  /**
   * Validate transaction data
   * @param {Object} data - Transaction data to validate
   * @returns {Object} Validated data
   */
  validateData(data) {
    const errors = [];

    // User validation
    if (!data.user || typeof data.user !== 'string') {
      errors.push('User is required and must be a string');
    }

    // Amount validation
    if (!data.amount || isNaN(parseFloat(data.amount))) {
      errors.push('Amount is required and must be a valid number');
    }

    // Type validation
    if (!data.type || !['credit', 'debit'].includes(data.type)) {
      errors.push('Type is required and must be either "credit" or "debit"');
    }

    // Description validation
    if (data.description && typeof data.description !== 'string') {
      errors.push('Description must be a string');
    }

    if (errors.length > 0) {
      throw new Error(`Validation failed: ${errors.join(', ')}`);
    }

    return {
      ...data,
      amount: parseFloat(data.amount),
      created_at: data.created_at || new Date()
    };
  }
}

module.exports = TransactionRepository;
