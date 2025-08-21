const { Pool } = require('pg');
const { logger } = require('@librechat/data-schemas');
const BaseAdapter = require('./BaseAdapter');
const { getMigrationRunner } = require('../migrations/MigrationRunner');

/**
 * PostgreSQL Database Adapter with Enhanced Performance & Production Features
 * Implements the BaseAdapter interface for PostgreSQL with MongoDB-compatible methods
 * Features: Connection pooling, query optimization, performance monitoring, prepared statements
 */
class PostgresAdapter extends BaseAdapter {
  constructor() {
    super();
    this.pool = null;
    this.migrationRunner = null;
    this.preparedStatements = new Map();
    this.connectionMetrics = {
      activeConnections: 0,
      totalQueries: 0,
      averageQueryTime: 0,
      errors: 0,
      slowQueries: 0
    };
    this.queryTimeHistory = [];
    this.slowQueryThreshold = parseInt(process.env.POSTGRES_SLOW_QUERY_THRESHOLD) || 1000; // ms
  }

  /**
   * Connect to PostgreSQL with Enhanced Connection Pooling
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
        // Enhanced connection pool settings for production
        max: parseInt(process.env.POSTGRES_MAX_CONNECTIONS) || 20,
        min: parseInt(process.env.POSTGRES_MIN_CONNECTIONS) || 2,
        idleTimeoutMillis: parseInt(process.env.POSTGRES_IDLE_TIMEOUT) || 30000,
        connectionTimeoutMillis: parseInt(process.env.POSTGRES_CONNECTION_TIMEOUT) || 30000,
        acquireTimeoutMillis: parseInt(process.env.POSTGRES_ACQUIRE_TIMEOUT) || 60000,
        createTimeoutMillis: parseInt(process.env.POSTGRES_CREATE_TIMEOUT) || 20000,
        destroyTimeoutMillis: parseInt(process.env.POSTGRES_DESTROY_TIMEOUT) || 5000,
        reapIntervalMillis: parseInt(process.env.POSTGRES_REAP_INTERVAL) || 1000,
        createRetryIntervalMillis: parseInt(process.env.POSTGRES_CREATE_RETRY_INTERVAL) || 200,
        // Performance optimizations
        statement_timeout: parseInt(process.env.POSTGRES_STATEMENT_TIMEOUT) || 30000,
        query_timeout: parseInt(process.env.POSTGRES_QUERY_TIMEOUT) || 30000,
        application_name: 'LibreChat',
        keepAlive: true,
        keepAliveInitialDelayMillis: 10000
      };

      this.pool = new Pool(config);
      
      // Enhanced connection event handlers
      this.pool.on('connect', (client) => {
        this.connectionMetrics.activeConnections++;
        logger.debug('PostgreSQL client connected', { 
          activeConnections: this.connectionMetrics.activeConnections 
        });
      });

      this.pool.on('remove', (client) => {
        this.connectionMetrics.activeConnections--;
        logger.debug('PostgreSQL client removed', { 
          activeConnections: this.connectionMetrics.activeConnections 
        });
      });

      this.pool.on('error', (err, client) => {
        this.connectionMetrics.errors++;
        logger.error('PostgreSQL pool error:', err);
      });

      // Test connection
      const client = await this.pool.connect();
      await client.query('SELECT NOW()');
      client.release();

      // Initialize schema if needed (skip in test environment)
      if (process.env.NODE_ENV !== 'test') {
        this.migrationRunner = getMigrationRunner();
        await this.migrationRunner.runMigrations();
      }
      
      logger.info('PostgreSQL adapter connected successfully', {
        host: config.host,
        port: config.port,
        database: config.database,
        maxConnections: config.max,
        minConnections: config.min
      });

      // Start performance monitoring
      this.startPerformanceMonitoring();

      return this.pool;
    } catch (error) {
      this.connectionMetrics.errors++;
      logger.error('PostgreSQL adapter connection failed:', error);
      throw error;
    }
  }

  /**
   * Start performance monitoring
   */
  startPerformanceMonitoring() {
    if (process.env.NODE_ENV === 'production') {
      // Monitor pool every 30 seconds
      setInterval(() => {
        this.logPoolStats();
      }, 30000);

      // Log slow queries and metrics every 5 minutes
      setInterval(() => {
        this.logPerformanceMetrics();
      }, 300000);
    }
  }

  /**
   * Log connection pool statistics
   */
  logPoolStats() {
    if (this.pool) {
      logger.info('PostgreSQL Pool Stats', {
        totalCount: this.pool.totalCount,
        idleCount: this.pool.idleCount,
        waitingCount: this.pool.waitingCount,
        activeConnections: this.connectionMetrics.activeConnections,
        totalQueries: this.connectionMetrics.totalQueries,
        averageQueryTime: this.connectionMetrics.averageQueryTime,
        errors: this.connectionMetrics.errors,
        slowQueries: this.connectionMetrics.slowQueries
      });
    }
  }

  /**
   * Log performance metrics
   */
  logPerformanceMetrics() {
    const metrics = {
      ...this.connectionMetrics,
      slowQueryThreshold: this.slowQueryThreshold,
      preparedStatementsCount: this.preparedStatements.size
    };

    logger.info('PostgreSQL Performance Metrics', metrics);

    // Reset counters (keep running averages)
    this.connectionMetrics.totalQueries = 0;
    this.connectionMetrics.slowQueries = 0;
    this.connectionMetrics.errors = 0;
  }

  /**
   * Execute query with performance tracking
   */
  async executeQuery(sql, params = [], options = {}) {
    const startTime = Date.now();
    let client;

    try {
      this.connectionMetrics.totalQueries++;

      // Use prepared statement if available and enabled
      if (options.usePrepared && this.preparedStatements.has(sql)) {
        const preparedName = this.preparedStatements.get(sql);
        client = await this.pool.connect();
        const result = await client.query({ name: preparedName, text: sql, values: params });
        client.release();
        
        this.trackQueryPerformance(startTime, sql, params, options);
        return result;
      }

      // Regular query execution
      client = await this.pool.connect();
      const result = await client.query(sql, params);
      client.release();
      
      this.trackQueryPerformance(startTime, sql, params, options);
      return result;

    } catch (error) {
      if (client) client.release();
      this.connectionMetrics.errors++;
      
      const duration = Date.now() - startTime;
      logger.error('PostgreSQL query failed', {
        error: error.message,
        sql: sql.substring(0, 200),
        params: params,
        duration
      });
      
      throw error;
    }
  }

  /**
   * Track query performance metrics
   */
  trackQueryPerformance(startTime, sql, params, options) {
    const duration = Date.now() - startTime;
    
    // Track slow queries
    if (duration > this.slowQueryThreshold) {
      this.connectionMetrics.slowQueries++;
      logger.warn('Slow PostgreSQL query detected', {
        duration,
        sql: sql.substring(0, 200),
        params: params,
        threshold: this.slowQueryThreshold
      });
    }

    // Update running average
    this.queryTimeHistory.push(duration);
    if (this.queryTimeHistory.length > 1000) {
      this.queryTimeHistory = this.queryTimeHistory.slice(-500);
    }
    
    const sum = this.queryTimeHistory.reduce((a, b) => a + b, 0);
    this.connectionMetrics.averageQueryTime = Math.round(sum / this.queryTimeHistory.length);
  }

  /**
   * Prepare statement for better performance
   */
  async prepareStatement(name, sql) {
    try {
      const client = await this.pool.connect();
      await client.query({ name, text: sql });
      client.release();
      
      this.preparedStatements.set(sql, name);
      logger.debug('PostgreSQL statement prepared', { name, sql: sql.substring(0, 100) });
    } catch (error) {
      logger.error('Failed to prepare PostgreSQL statement', { name, error: error.message });
      throw error;
    }
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics() {
    return {
      ...this.connectionMetrics,
      poolStats: this.pool ? {
        totalCount: this.pool.totalCount,
        idleCount: this.pool.idleCount,
        waitingCount: this.pool.waitingCount
      } : null,
      preparedStatementsCount: this.preparedStatements.size,
      slowQueryThreshold: this.slowQueryThreshold
    };
  }

  /**
   * Disconnect from PostgreSQL
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

  getType() {
    return 'postgresql';
  }

  /**
   * Convert MongoDB collection name to PostgreSQL table name
   */
  getTableName(collection) {
    const tableMap = {
      'users': 'users',
      'conversations': 'conversations', 
      'messages': 'messages',
      'sessions': 'sessions',
      'files': 'files',
      'presets': 'presets',
      'agents': 'agents',
      'balances': 'balances',
      'pluginauths': 'plugin_auths'
    };
    return tableMap[collection.toLowerCase()] || collection.toLowerCase();
  }

  /**
   * Convert MongoDB field names to PostgreSQL column names
   */
  convertFieldToColumn(field) {
    const fieldMap = {
      '_id': 'id',
      'conversationId': 'conversation_id',
      'messageId': 'message_id',
      'parentMessageId': 'parent_message_id',
      'isCreatedByUser': 'is_created_by_user',
      'tokenCount': 'token_count',
      'summaryTokenCount': 'summary_token_count',
      'userId': 'user_id',
      'refreshTokenHash': 'refresh_token_hash',
      'createdAt': 'created_at',
      'updatedAt': 'updated_at',
      'iconURL': 'icon_url',
      'clientId': 'client_id',
      'invocationId': 'invocation_id',
      'conversationSignature': 'conversation_signature',
      'finishReason': 'finish_reason',
      'unfinishedReason': 'unfinished_reason',
      'expiredAt': 'expired_at',
      'twoFactorEnabled': 'two_factor_enabled',
      'totpSecret': 'totp_secret',
      'backupCodes': 'backup_codes',
      'refreshToken': 'refresh_token',
      'expiresAt': 'expires_at',
      'termsAccepted': 'terms_accepted',
      'idOnTheSource': 'id_on_the_source',
      'emailVerified': 'email_verified'
    };
    return fieldMap[field] || field.toLowerCase();
  }

  /**
   * Convert PostgreSQL row to MongoDB-like document
   */
  convertToDocument(row, collection) {
    if (!row) return null;

    const doc = { ...row };
    
    // Convert PostgreSQL columns back to MongoDB field names
    const reverseFieldMap = {
      'conversation_id': 'conversationId',
      'message_id': 'messageId',
      'parent_message_id': 'parentMessageId',
      'is_created_by_user': 'isCreatedByUser',
      'token_count': 'tokenCount',
      'summary_token_count': 'summaryTokenCount',
      'user_id': 'user',
      'refresh_token_hash': 'refreshTokenHash',
      'created_at': 'createdAt',
      'updated_at': 'updatedAt',
      'icon_url': 'iconURL',
      'client_id': 'clientId',
      'invocation_id': 'invocationId',
      'conversation_signature': 'conversationSignature',
      'finish_reason': 'finishReason',
      'expired_at': 'expiredAt',
      'two_factor_enabled': 'twoFactorEnabled',
      'totp_secret': 'totpSecret',
      'backup_codes': 'backupCodes',
      'refresh_token': 'refreshToken',
      'expires_at': 'expiresAt',
      'terms_accepted': 'termsAccepted',
      'id_on_the_source': 'idOnTheSource',
      'email_verified': 'emailVerified'
    };

    // Convert column names back to MongoDB field names
    for (const [pgCol, mongoField] of Object.entries(reverseFieldMap)) {
      if (doc[pgCol] !== undefined) {
        doc[mongoField] = doc[pgCol];
        delete doc[pgCol];
      }
    }

    // For users, keep 'id' field, for others convert to '_id'
    if (collection === 'users') {
      // Keep the UUID as 'id' for users
      if (doc.user_id) {
        doc.user = doc.user_id;
        delete doc.user_id;
      }
    } else {
      // For other collections, add _id field
      if (doc.id && !doc._id) {
        doc._id = doc.id;
      }
      if (doc.user_id) {
        doc.user = doc.user_id;
        delete doc.user_id;
      }
    }

    return doc;
  }

  /**
   * Convert MongoDB-like document to PostgreSQL row
   */
  convertToRow(data, collection) {
    const row = { ...data };
    
    // Convert MongoDB fields to PostgreSQL columns
    for (const [field, value] of Object.entries(data)) {
      const pgColumn = this.convertFieldToColumn(field);
      if (pgColumn !== field) {
        row[pgColumn] = value;
        delete row[field];
      }
    }

    // Handle special field conversions
    if (row._id) {
      delete row._id; // PostgreSQL auto-generates id
    }
    
    if (row.user && !row.user_id) {
      row.user_id = row.user;
      delete row.user;
    }

    return row;
  }

  /**
   * Build WHERE clause from MongoDB-style query
   */
  buildWhereClause(query) {
    const conditions = [];
    const values = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(query)) {
      const pgField = this.convertFieldToColumn(key);
      
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        if (value.$in && Array.isArray(value.$in)) {
          const placeholders = value.$in.map(() => `$${paramIndex++}`).join(',');
          conditions.push(`${pgField} IN (${placeholders})`);
          values.push(...value.$in);
        } else if (value.$gt !== undefined) {
          conditions.push(`${pgField} > $${paramIndex++}`);
          values.push(value.$gt);
        } else if (value.$lt !== undefined) {
          conditions.push(`${pgField} < $${paramIndex++}`);
          values.push(value.$lt);
        } else if (value.$gte !== undefined) {
          conditions.push(`${pgField} >= $${paramIndex++}`);
          values.push(value.$gte);
        } else if (value.$lte !== undefined) {
          conditions.push(`${pgField} <= $${paramIndex++}`);
          values.push(value.$lte);
        } else if (value.$ne !== undefined) {
          conditions.push(`${pgField} != $${paramIndex++}`);
          values.push(value.$ne);
        } else {
          // For complex objects, use JSONB comparison if the field is JSONB
          conditions.push(`${pgField} = $${paramIndex++}`);
          values.push(JSON.stringify(value));
        }
      } else {
        conditions.push(`${pgField} = $${paramIndex++}`);
        values.push(value);
      }
    }

    return {
      whereClause: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
      values
    };
  }

  // MongoDB-compatible methods

  async findById(collection, id) {
    try {
      const tableName = this.getTableName(collection);
      
      // Determine the ID field based on collection
      let idField = 'id';
      if (collection === 'messages') {
        idField = 'message_id';
      } else if (collection === 'conversations') {
        idField = 'conversation_id';
      }
      
      const query = `SELECT * FROM ${tableName} WHERE ${idField} = $1`;
      const result = await this.pool.query(query, [id]);
      
      return this.convertToDocument(result.rows[0], collection);
    } catch (error) {
      logger.error(`Error finding by ID in ${collection}:`, error);
      throw error;
    }
  }

  async findOne(collection, query) {
    try {
      const tableName = this.getTableName(collection);
      const { whereClause, values } = this.buildWhereClause(query);
      
      const sql = `SELECT * FROM ${tableName} ${whereClause} LIMIT 1`;
      const result = await this.pool.query(sql, values);
      
      return this.convertToDocument(result.rows[0], collection);
    } catch (error) {
      logger.error(`Error finding one in ${collection}:`, error);
      throw error;
    }
  }

  async findMany(collection, query = {}, options = {}) {
    try {
      const tableName = this.getTableName(collection);
      const { whereClause, values } = this.buildWhereClause(query);
      
      let sql = `SELECT * FROM ${tableName} ${whereClause}`;
      
      // Handle sorting
      if (options.sort) {
        const sortFields = Object.entries(options.sort)
          .map(([field, direction]) => {
            const pgField = this.convertFieldToColumn(field);
            return `${pgField} ${direction === -1 ? 'DESC' : 'ASC'}`;
          })
          .join(', ');
        sql += ` ORDER BY ${sortFields}`;
      }
      
      // Handle pagination
      if (options.limit) {
        sql += ` LIMIT ${options.limit}`;
      }
      if (options.skip) {
        sql += ` OFFSET ${options.skip}`;
      }
      
      const result = await this.pool.query(sql, values);
      return result.rows.map(row => this.convertToDocument(row, collection));
    } catch (error) {
      logger.error(`Error finding many in ${collection}:`, error);
      throw error;
    }
  }

  async create(collection, data) {
    try {
      const tableName = this.getTableName(collection);
      const pgData = this.convertToRow(data, collection);
      
      const fields = Object.keys(pgData);
      const values = Object.values(pgData);
      const placeholders = values.map((_, index) => `$${index + 1}`);
      
      const sql = `
        INSERT INTO ${tableName} (${fields.join(', ')}) 
        VALUES (${placeholders.join(', ')}) 
        RETURNING *
      `;
      
      const result = await this.pool.query(sql, values);
      return this.convertToDocument(result.rows[0], collection);
    } catch (error) {
      logger.error(`Error creating in ${collection}:`, error);
      throw error;
    }
  }

  async updateById(collection, id, update) {
    try {
      const tableName = this.getTableName(collection);
      
      // Determine the ID field
      let idField = 'id';
      if (collection === 'messages') {
        idField = 'message_id';
      } else if (collection === 'conversations') {
        idField = 'conversation_id';
      }
      
      const pgUpdate = this.convertToRow(update, collection);
      
      // Remove id field from update
      delete pgUpdate.id;
      delete pgUpdate[idField];
      
      const setFields = Object.keys(pgUpdate).map((field, index) => `${field} = $${index + 1}`);
      const values = Object.values(pgUpdate);
      values.push(id); // Add ID as last parameter
      
      const sql = `
        UPDATE ${tableName} 
        SET ${setFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
        WHERE ${idField} = $${values.length}
        RETURNING *
      `;
      
      const result = await this.pool.query(sql, values);
      return this.convertToDocument(result.rows[0], collection);
    } catch (error) {
      logger.error(`Error updating by ID in ${collection}:`, error);
      throw error;
    }
  }

  async deleteById(collection, id) {
    try {
      const tableName = this.getTableName(collection);
      
      // Determine the ID field
      let idField = 'id';
      if (collection === 'messages') {
        idField = 'message_id';
      } else if (collection === 'conversations') {
        idField = 'conversation_id';
      }
      
      const sql = `DELETE FROM ${tableName} WHERE ${idField} = $1`;
      const result = await this.pool.query(sql, [id]);
      
      return result.rowCount > 0;
    } catch (error) {
      logger.error(`Error deleting by ID in ${collection}:`, error);
      throw error;
    }
  }

  async deleteMany(collection, query) {
    try {
      const tableName = this.getTableName(collection);
      const { whereClause, values } = this.buildWhereClause(query);
      
      const sql = `DELETE FROM ${tableName} ${whereClause}`;
      const result = await this.pool.query(sql, values);
      
      return { deletedCount: result.rowCount };
    } catch (error) {
      logger.error(`Error deleting many in ${collection}:`, error);
      throw error;
    }
  }

  async count(collection, query = {}) {
    try {
      const tableName = this.getTableName(collection);
      const { whereClause, values } = this.buildWhereClause(query);
      
      const sql = `SELECT COUNT(*) as count FROM ${tableName} ${whereClause}`;
      const result = await this.pool.query(sql, values);
      
      return parseInt(result.rows[0].count);
    } catch (error) {
      logger.error(`Error counting in ${collection}:`, error);
      throw error;
    }
  }

  // MongoDB-style findOneAndUpdate for exact compatibility
  async findOneAndUpdate(collection, query, update, options = {}) {
    try {
      const existing = await this.findOne(collection, query);
      
      if (!existing && options.upsert) {
        // Create new document
        const newDoc = { ...query, ...update };
        return await this.create(collection, newDoc);
      } else if (existing) {
        // Update existing document
        let id;
        if (collection === 'messages') {
          id = existing.messageId;
        } else if (collection === 'conversations') {
          id = existing.conversationId;
        } else {
          id = existing.id;
        }
        
        const updated = await this.updateById(collection, id, update);
        return options.new !== false ? updated : existing;
      }
      
      return null;
    } catch (error) {
      logger.error(`Error in findOneAndUpdate for ${collection}:`, error);
      throw error;
    }
  }

  // Additional PostgreSQL-specific methods
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
}

module.exports = PostgresAdapter;
