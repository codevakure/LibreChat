const { Pool } = require('pg');
const { logger } = require('@librechat/data-schemas');
const BaseAdapter = require('./BaseAdapter');

/**
 * PostgreSQL Database Adapter
 * Implements the BaseAdapter interface for PostgreSQL
 */
class PostgresAdapter extends BaseAdapter {
  constructor() {
    super();
    this.pool = null;
    this.schemas = {};
  }

  /**
   * Connect to PostgreSQL
   * @returns {Promise<void>}
   */
  async connect() {
    try {
      const config = {
        host: process.env.POSTGRES_HOST || 'localhost',
        port: parseInt(process.env.POSTGRES_PORT) || 5432,
        database: process.env.POSTGRES_DATABASE || 'librechat',
        user: process.env.POSTGRES_USERNAME || 'librechat_user',
        password: process.env.POSTGRES_PASSWORD,
        ssl: process.env.POSTGRES_SSL === 'true' ? { rejectUnauthorized: false } : false,
        max: parseInt(process.env.POSTGRES_MAX_CONNECTIONS) || 20,
        connectionTimeoutMillis: parseInt(process.env.POSTGRES_CONNECTION_TIMEOUT) || 30000,
      };

      this.pool = new Pool(config);
      
      // Test the connection
      const client = await this.pool.connect();
      client.release();
      
      logger.info('PostgreSQL adapter connected successfully');
      return this.pool;
    } catch (error) {
      logger.error('PostgreSQL adapter connection failed:', error);
      throw error;
    }
  }

  /**
   * Disconnect from PostgreSQL
   * @returns {Promise<void>}
   */
  async disconnect() {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      logger.info('PostgreSQL adapter disconnected');
    }
  }

  /**
   * Disconnect from PostgreSQL
   * @returns {Promise<void>}
   */
  async disconnect() {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      logger.info('PostgreSQL adapter disconnected');
    }
  }
  isConnected() {
    return this.pool && !this.pool.ending;
  }

  /**
   * Get table schema
   * @param {string} table - Table name
   * @returns {Object}
   */
  getSchema(table) {
    // TODO: Implement table schemas for PostgreSQL
    return this.schemas[table] || {};
  }

  /**
   * Execute SQL query
   * @param {string} sql - SQL query
   * @param {Array} params - Query parameters
   * @returns {Promise<Object>}
   */
  async query(sql, params = []) {
    try {
      const client = await this.pool.connect();
      try {
        const result = await client.query(sql, params);
        return result;
      } finally {
        client.release();
      }
    } catch (error) {
      logger.error('PostgreSQL query error:', error);
      throw error;
    }
  }

  /**
   * Find a single record by ID
   * @param {string} table - Table name
   * @param {string} id - Record ID
   * @returns {Promise<Object|null>}
   */
  async findById(table, id) {
    try {
      const sql = `SELECT * FROM ${table} WHERE id = $1`;
      const result = await this.query(sql, [id]);
      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
      logger.error(`Error finding by ID in ${table}:`, error);
      throw error;
    }
  }

  /**
   * Find multiple records with optional query and options
   * @param {string} table - Table name
   * @param {Object} query - Query conditions
   * @param {Object} options - Query options
   * @returns {Promise<Array>}
   */
  async findMany(table, query = {}, options = {}) {
    try {
      let sql = `SELECT * FROM ${table}`;
      const params = [];
      let paramIndex = 1;

      // Build WHERE clause
      if (Object.keys(query).length > 0) {
        const conditions = [];
        for (const [key, value] of Object.entries(query)) {
          conditions.push(`${key} = $${paramIndex}`);
          params.push(value);
          paramIndex++;
        }
        sql += ` WHERE ${conditions.join(' AND ')}`;
      }

      // Add ORDER BY
      if (options.sort) {
        const sortFields = [];
        for (const [field, direction] of Object.entries(options.sort)) {
          sortFields.push(`${field} ${direction === 1 ? 'ASC' : 'DESC'}`);
        }
        sql += ` ORDER BY ${sortFields.join(', ')}`;
      }

      // Add LIMIT and OFFSET
      if (options.limit) {
        sql += ` LIMIT $${paramIndex}`;
        params.push(options.limit);
        paramIndex++;
      }

      if (options.skip) {
        sql += ` OFFSET $${paramIndex}`;
        params.push(options.skip);
      }

      const result = await this.query(sql, params);
      return result.rows;
    } catch (error) {
      logger.error(`Error finding many in ${table}:`, error);
      throw error;
    }
  }

  /**
   * Find a single record with query
   * @param {string} table - Table name
   * @param {Object} query - Query conditions
   * @param {Object} options - Query options
   * @returns {Promise<Object|null>}
   */
  async findOne(table, query, options = {}) {
    try {
      const results = await this.findMany(table, query, { ...options, limit: 1 });
      return results.length > 0 ? results[0] : null;
    } catch (error) {
      logger.error(`Error finding one in ${table}:`, error);
      throw error;
    }
  }

  /**
   * Create a new record
   * @param {string} table - Table name
   * @param {Object} data - Data to insert
   * @returns {Promise<Object>}
   */
  async create(table, data) {
    try {
      const fields = Object.keys(data);
      const values = Object.values(data);
      const placeholders = values.map((_, index) => `$${index + 1}`).join(', ');
      
      const sql = `
        INSERT INTO ${table} (${fields.join(', ')})
        VALUES (${placeholders})
        RETURNING *
      `;
      
      const result = await this.query(sql, values);
      return result.rows[0];
    } catch (error) {
      logger.error(`Error creating in ${table}:`, error);
      throw error;
    }
  }

  /**
   * Create multiple records
   * @param {string} table - Table name
   * @param {Array} dataArray - Array of data to insert
   * @returns {Promise<Array>}
   */
  async createMany(table, dataArray) {
    try {
      // TODO: Implement bulk insert for PostgreSQL
      const results = [];
      for (const data of dataArray) {
        const result = await this.create(table, data);
        results.push(result);
      }
      return results;
    } catch (error) {
      logger.error(`Error creating many in ${table}:`, error);
      throw error;
    }
  }

  /**
   * Update a record by ID
   * @param {string} table - Table name
   * @param {string} id - Record ID
   * @param {Object} data - Data to update
   * @returns {Promise<Object|null>}
   */
  async updateById(table, id, data) {
    try {
      const fields = Object.keys(data);
      const values = Object.values(data);
      const setClause = fields.map((field, index) => `${field} = $${index + 2}`).join(', ');
      
      const sql = `
        UPDATE ${table}
        SET ${setClause}
        WHERE id = $1
        RETURNING *
      `;
      
      const result = await this.query(sql, [id, ...values]);
      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
      logger.error(`Error updating by ID in ${table}:`, error);
      throw error;
    }
  }

  /**
   * Update multiple records
   * @param {string} table - Table name
   * @param {Object} query - Query conditions
   * @param {Object} data - Data to update
   * @returns {Promise<Object>}
   */
  async updateMany(table, query, data) {
    try {
      // TODO: Implement proper updateMany for PostgreSQL
      const results = await this.findMany(table, query);
      let modifiedCount = 0;
      
      for (const record of results) {
        await this.updateById(table, record.id, data);
        modifiedCount++;
      }
      
      return {
        acknowledged: true,
        modifiedCount,
        matchedCount: results.length
      };
    } catch (error) {
      logger.error(`Error updating many in ${table}:`, error);
      throw error;
    }
  }

  /**
   * Delete a record by ID
   * @param {string} table - Table name
   * @param {string} id - Record ID
   * @returns {Promise<boolean>}
   */
  async deleteById(table, id) {
    try {
      const sql = `DELETE FROM ${table} WHERE id = $1`;
      const result = await this.query(sql, [id]);
      return result.rowCount > 0;
    } catch (error) {
      logger.error(`Error deleting by ID in ${table}:`, error);
      throw error;
    }
  }

  /**
   * Delete multiple records
   * @param {string} table - Table name
   * @param {Object} query - Query conditions
   * @returns {Promise<Object>}
   */
  async deleteMany(table, query) {
    try {
      let sql = `DELETE FROM ${table}`;
      const params = [];
      let paramIndex = 1;

      if (Object.keys(query).length > 0) {
        const conditions = [];
        for (const [key, value] of Object.entries(query)) {
          conditions.push(`${key} = $${paramIndex}`);
          params.push(value);
          paramIndex++;
        }
        sql += ` WHERE ${conditions.join(' AND ')}`;
      }

      const result = await this.query(sql, params);
      return {
        acknowledged: true,
        deletedCount: result.rowCount
      };
    } catch (error) {
      logger.error(`Error deleting many in ${table}:`, error);
      throw error;
    }
  }

  /**
   * Count records matching query
   * @param {string} table - Table name
   * @param {Object} query - Query conditions
   * @returns {Promise<number>}
   */
  async count(table, query = {}) {
    try {
      let sql = `SELECT COUNT(*) as count FROM ${table}`;
      const params = [];
      let paramIndex = 1;

      if (Object.keys(query).length > 0) {
        const conditions = [];
        for (const [key, value] of Object.entries(query)) {
          conditions.push(`${key} = $${paramIndex}`);
          params.push(value);
          paramIndex++;
        }
        sql += ` WHERE ${conditions.join(' AND ')}`;
      }

      const result = await this.query(sql, params);
      return parseInt(result.rows[0].count);
    } catch (error) {
      logger.error(`Error counting in ${table}:`, error);
      throw error;
    }
  }

  /**
   * Execute aggregation pipeline (simplified for PostgreSQL)
   * @param {string} table - Table name
   * @param {Array} pipeline - Aggregation pipeline
   * @returns {Promise<Array>}
   */
  async aggregate(table, pipeline) {
    // TODO: Implement proper aggregation for PostgreSQL
    logger.warn('PostgreSQL aggregation not fully implemented yet');
    return [];
  }

  /**
   * Start a database transaction
   * @returns {Promise<Object>}
   */
  async startTransaction() {
    const client = await this.pool.connect();
    await client.query('BEGIN');
    return client;
  }

  /**
   * Commit a transaction
   * @param {Object} client - PostgreSQL client
   * @returns {Promise<void>}
   */
  async commitTransaction(client) {
    await client.query('COMMIT');
    client.release();
  }

  /**
   * Rollback a transaction
   * @param {Object} client - PostgreSQL client
   * @returns {Promise<void>}
   */
  async rollbackTransaction(client) {
    await client.query('ROLLBACK');
    client.release();
  }

  /**
   * Get database type identifier
   * @returns {string}
   */
  getType() {
    return 'postgresql';
  }
}

module.exports = PostgresAdapter;
