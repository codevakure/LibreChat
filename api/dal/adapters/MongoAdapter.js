const mongoose = require('mongoose');
const { logger } = require('@librechat/data-schemas');
const { connectDb } = require('../../db/connect');
const BaseAdapter = require('./BaseAdapter');

/**
 * MongoDB Database Adapter
 * Implements the BaseAdapter interface for MongoDB using Mongoose
 */
class MongoAdapter extends BaseAdapter {
  constructor() {
    super();
    this.connection = null;
    this.models = {};
  }

  /**
   * Connect to MongoDB
   * @returns {Promise<void>}
   */
  async connect() {
    try {
      this.connection = await connectDb();
      
      // Load existing models from the models module
      const existingModels = require('../../db/models');
      this.models = existingModels;
      
      logger.info('MongoDB adapter connected successfully');
      return this.connection;
    } catch (error) {
      logger.error('MongoDB adapter connection failed:', error);
      throw error;
    }
  }

  /**
   * Disconnect from MongoDB
   * @returns {Promise<void>}
   */
  async disconnect() {
    if (this.connection) {
      await mongoose.disconnect();
      this.connection = null;
      logger.info('MongoDB adapter disconnected');
    }
  }

  /**
   * Check if MongoDB connection is ready
   * @returns {boolean}
   */
  isConnected() {
    return this.connection && this.connection.readyState === 1;
  }

  /**
   * Get model by collection name
   * @param {string} collection - Collection name
   * @returns {mongoose.Model}
   */
  getModel(collection) {
    const modelName = this._normalizeModelName(collection);
    const model = this.models[modelName];
    
    if (!model) {
      throw new Error(`Model ${modelName} not found for collection ${collection}`);
    }
    
    return model;
  }

  /**
   * Normalize collection name to model name
   * @param {string} collection - Collection name
   * @returns {string}
   */
  _normalizeModelName(collection) {
    // Convert collection names to model names
    const modelMap = {
      'users': 'User',
      'conversations': 'Conversation',
      'messages': 'Message',
      'agents': 'Agent',
      'files': 'File',
      'presets': 'Preset',
      'sessions': 'Session',
      'balances': 'Balance',
      'plugin_auths': 'PluginAuth',
      'keys': 'Key',
      'roles': 'Role',
      'permissions': 'Permission',
      'tools': 'Tool',
      'actions': 'Action',
      'prompts': 'Prompt'
    };

    return modelMap[collection] || collection;
  }

  /**
   * Convert MongoDB ObjectId to string
   * @param {Object} doc - MongoDB document
   * @returns {Object}
   */
  _normalizeDocument(doc) {
    if (!doc) return null;
    
    const normalized = doc.toObject ? doc.toObject() : doc;
    
    // Convert _id to id
    if (normalized._id) {
      normalized.id = normalized._id.toString();
    }
    
    return normalized;
  }

  /**
   * Find a single record by ID
   * @param {string} collection - Collection name
   * @param {string} id - Record ID
   * @returns {Promise<Object|null>}
   */
  async findById(collection, id) {
    try {
      const model = this.getModel(collection);
      const doc = await model.findById(id);
      return this._normalizeDocument(doc);
    } catch (error) {
      logger.error(`Error finding by ID in ${collection}:`, error);
      throw error;
    }
  }

  /**
   * Find multiple records with optional query and options
   * @param {string} collection - Collection name
   * @param {Object} query - Query conditions
   * @param {Object} options - Query options
   * @returns {Promise<Array>}
   */
  async findMany(collection, query = {}, options = {}) {
    try {
      const model = this.getModel(collection);
      
      let queryBuilder = model.find(query);
      
      // Apply options
      if (options.sort) {
        queryBuilder = queryBuilder.sort(options.sort);
      }
      
      if (options.limit) {
        queryBuilder = queryBuilder.limit(options.limit);
      }
      
      if (options.skip && options.skip > 0) {
        queryBuilder = queryBuilder.skip(options.skip);
      }
      
      if (options.populate) {
        queryBuilder = queryBuilder.populate(options.populate);
      }
      
      if (options.select) {
        queryBuilder = queryBuilder.select(options.select);
      }
      
      const docs = await queryBuilder.exec();
      return docs.map(doc => this._normalizeDocument(doc));
    } catch (error) {
      logger.error(`Error finding many in ${collection}:`, error);
      throw error;
    }
  }

  /**
   * Find a single record with query
   * @param {string} collection - Collection name
   * @param {Object} query - Query conditions
   * @param {Object} options - Query options
   * @returns {Promise<Object|null>}
   */
  async findOne(collection, query, options = {}) {
    try {
      const model = this.getModel(collection);
      
      let queryBuilder = model.findOne(query);
      
      if (options.populate) {
        queryBuilder = queryBuilder.populate(options.populate);
      }
      
      if (options.select) {
        queryBuilder = queryBuilder.select(options.select);
      }
      
      const doc = await queryBuilder.exec();
      return this._normalizeDocument(doc);
    } catch (error) {
      logger.error(`Error finding one in ${collection}:`, error);
      throw error;
    }
  }

  /**
   * Create a new record
   * @param {string} collection - Collection name
   * @param {Object} data - Data to insert
   * @returns {Promise<Object>}
   */
  async create(collection, data) {
    try {
      const model = this.getModel(collection);
      const doc = await model.create(data);
      return this._normalizeDocument(doc);
    } catch (error) {
      logger.error(`Error creating in ${collection}:`, error);
      throw error;
    }
  }

  /**
   * Create multiple records
   * @param {string} collection - Collection name
   * @param {Array} dataArray - Array of data to insert
   * @returns {Promise<Array>}
   */
  async createMany(collection, dataArray) {
    try {
      const model = this.getModel(collection);
      const docs = await model.insertMany(dataArray);
      return docs.map(doc => this._normalizeDocument(doc));
    } catch (error) {
      logger.error(`Error creating many in ${collection}:`, error);
      throw error;
    }
  }

  /**
   * Update a record by ID
   * @param {string} collection - Collection name
   * @param {string} id - Record ID
   * @param {Object} data - Data to update
   * @returns {Promise<Object|null>}
   */
  async updateById(collection, id, data) {
    try {
      const model = this.getModel(collection);
      const doc = await model.findByIdAndUpdate(id, data, { new: true });
      return this._normalizeDocument(doc);
    } catch (error) {
      logger.error(`Error updating by ID in ${collection}:`, error);
      throw error;
    }
  }

  /**
   * Update multiple records
   * @param {string} collection - Collection name
   * @param {Object} query - Query conditions
   * @param {Object} data - Data to update
   * @returns {Promise<Object>}
   */
  async updateMany(collection, query, data) {
    try {
      const model = this.getModel(collection);
      const result = await model.updateMany(query, data);
      return {
        acknowledged: result.acknowledged,
        modifiedCount: result.modifiedCount,
        matchedCount: result.matchedCount
      };
    } catch (error) {
      logger.error(`Error updating many in ${collection}:`, error);
      throw error;
    }
  }

  /**
   * Delete a record by ID
   * @param {string} collection - Collection name
   * @param {string} id - Record ID
   * @returns {Promise<boolean>}
   */
  async deleteById(collection, id) {
    try {
      const model = this.getModel(collection);
      const result = await model.findByIdAndDelete(id);
      return result !== null;
    } catch (error) {
      logger.error(`Error deleting by ID in ${collection}:`, error);
      throw error;
    }
  }

  /**
   * Delete multiple records
   * @param {string} collection - Collection name
   * @param {Object} query - Query conditions
   * @returns {Promise<Object>}
   */
  async deleteMany(collection, query) {
    try {
      const model = this.getModel(collection);
      const result = await model.deleteMany(query);
      return {
        acknowledged: result.acknowledged,
        deletedCount: result.deletedCount
      };
    } catch (error) {
      logger.error(`Error deleting many in ${collection}:`, error);
      throw error;
    }
  }

  /**
   * Count records matching query
   * @param {string} collection - Collection name
   * @param {Object} query - Query conditions
   * @returns {Promise<number>}
   */
  async count(collection, query = {}) {
    try {
      const model = this.getModel(collection);
      return await model.countDocuments(query);
    } catch (error) {
      logger.error(`Error counting in ${collection}:`, error);
      throw error;
    }
  }

  /**
   * Execute aggregation pipeline
   * @param {string} collection - Collection name
   * @param {Array} pipeline - Aggregation pipeline
   * @returns {Promise<Array>}
   */
  async aggregate(collection, pipeline) {
    try {
      const model = this.getModel(collection);
      const results = await model.aggregate(pipeline);
      return results.map(result => this._normalizeDocument(result));
    } catch (error) {
      logger.error(`Error aggregating in ${collection}:`, error);
      throw error;
    }
  }

  /**
   * Start a database transaction
   * @returns {Promise<Object>}
   */
  async startTransaction() {
    const session = await mongoose.startSession();
    session.startTransaction();
    return session;
  }

  /**
   * Commit a transaction
   * @param {Object} session - Mongoose session
   * @returns {Promise<void>}
   */
  async commitTransaction(session) {
    await session.commitTransaction();
    session.endSession();
  }

  /**
   * Rollback a transaction
   * @param {Object} session - Mongoose session
   * @returns {Promise<void>}
   */
  async rollbackTransaction(session) {
    await session.abortTransaction();
    session.endSession();
  }

  /**
   * Get database type identifier
   * @returns {string}
   */
  getType() {
    return 'mongodb';
  }
}

module.exports = MongoAdapter;
