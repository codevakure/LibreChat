/**
 * Abstract Base Database Adapter
 * Defines the interface that all database adapters must implement
 */
class BaseAdapter {
  constructor() {
    if (this.constructor === BaseAdapter) {
      throw new Error('BaseAdapter is an abstract class and cannot be instantiated directly');
    }
  }

  /**
   * Connect to the database
   * @returns {Promise<void>}
   */
  async connect() {
    throw new Error('connect() method must be implemented by subclass');
  }

  /**
   * Disconnect from the database
   * @returns {Promise<void>}
   */
  async disconnect() {
    throw new Error('disconnect() method must be implemented by subclass');
  }

  /**
   * Check if the database connection is ready
   * @returns {boolean}
   */
  isConnected() {
    throw new Error('isConnected() method must be implemented by subclass');
  }

  /**
   * Find a single record by ID
   * @param {string} collection - Collection/table name
   * @param {string} id - Record ID
   * @returns {Promise<Object|null>}
   */
  async findById(collection, id) {
    throw new Error('findById() method must be implemented by subclass');
  }

  /**
   * Find multiple records with optional query and options
   * @param {string} collection - Collection/table name
   * @param {Object} query - Query conditions
   * @param {Object} options - Query options (sort, limit, skip, etc.)
   * @returns {Promise<Array>}
   */
  async findMany(collection, query = {}, options = {}) {
    throw new Error('findMany() method must be implemented by subclass');
  }

  /**
   * Find a single record with query
   * @param {string} collection - Collection/table name
   * @param {Object} query - Query conditions
   * @param {Object} options - Query options
   * @returns {Promise<Object|null>}
   */
  async findOne(collection, query, options = {}) {
    throw new Error('findOne() method must be implemented by subclass');
  }

  /**
   * Create a new record
   * @param {string} collection - Collection/table name
   * @param {Object} data - Data to insert
   * @returns {Promise<Object>}
   */
  async create(collection, data) {
    throw new Error('create() method must be implemented by subclass');
  }

  /**
   * Create multiple records
   * @param {string} collection - Collection/table name
   * @param {Array} dataArray - Array of data to insert
   * @returns {Promise<Array>}
   */
  async createMany(collection, dataArray) {
    throw new Error('createMany() method must be implemented by subclass');
  }

  /**
   * Update a record by ID
   * @param {string} collection - Collection/table name
   * @param {string} id - Record ID
   * @param {Object} data - Data to update
   * @returns {Promise<Object|null>}
   */
  async updateById(collection, id, data) {
    throw new Error('updateById() method must be implemented by subclass');
  }

  /**
   * Update multiple records
   * @param {string} collection - Collection/table name
   * @param {Object} query - Query conditions
   * @param {Object} data - Data to update
   * @returns {Promise<Object>} - Update result with count
   */
  async updateMany(collection, query, data) {
    throw new Error('updateMany() method must be implemented by subclass');
  }

  /**
   * Delete a record by ID
   * @param {string} collection - Collection/table name
   * @param {string} id - Record ID
   * @returns {Promise<boolean>}
   */
  async deleteById(collection, id) {
    throw new Error('deleteById() method must be implemented by subclass');
  }

  /**
   * Delete multiple records
   * @param {string} collection - Collection/table name
   * @param {Object} query - Query conditions
   * @returns {Promise<Object>} - Delete result with count
   */
  async deleteMany(collection, query) {
    throw new Error('deleteMany() method must be implemented by subclass');
  }

  /**
   * Count records matching query
   * @param {string} collection - Collection/table name
   * @param {Object} query - Query conditions
   * @returns {Promise<number>}
   */
  async count(collection, query = {}) {
    throw new Error('count() method must be implemented by subclass');
  }

  /**
   * Execute aggregation pipeline
   * @param {string} collection - Collection/table name
   * @param {Array} pipeline - Aggregation pipeline
   * @returns {Promise<Array>}
   */
  async aggregate(collection, pipeline) {
    throw new Error('aggregate() method must be implemented by subclass');
  }

  /**
   * Start a database transaction
   * @returns {Promise<Object>} - Transaction object
   */
  async startTransaction() {
    throw new Error('startTransaction() method must be implemented by subclass');
  }

  /**
   * Commit a transaction
   * @param {Object} transaction - Transaction object
   * @returns {Promise<void>}
   */
  async commitTransaction(transaction) {
    throw new Error('commitTransaction() method must be implemented by subclass');
  }

  /**
   * Rollback a transaction
   * @param {Object} transaction - Transaction object
   * @returns {Promise<void>}
   */
  async rollbackTransaction(transaction) {
    throw new Error('rollbackTransaction() method must be implemented by subclass');
  }

  /**
   * Execute a function within a transaction
   * @param {Function} fn - Function to execute
   * @returns {Promise<any>}
   */
  async withTransaction(fn) {
    const transaction = await this.startTransaction();
    try {
      const result = await fn(transaction);
      await this.commitTransaction(transaction);
      return result;
    } catch (error) {
      await this.rollbackTransaction(transaction);
      throw error;
    }
  }

  /**
   * Get database type identifier
   * @returns {string}
   */
  getType() {
    throw new Error('getType() method must be implemented by subclass');
  }
}

module.exports = BaseAdapter;
