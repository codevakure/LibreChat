const { logger } = require('@librechat/data-schemas');

/**
 * Base Repository Class
 * Provides common database operations that all repositories inherit
 */
class BaseRepository {
  constructor(adapter, tableName = null) {
    if (!adapter) {
      throw new Error('Adapter is required for repository');
    }
    
    this.adapter = adapter;
    this.tableName = tableName || this.getTableName();
    this.collection = this.tableName; // For compatibility with repositories that use this.collection
    
    if (!this.tableName) {
      throw new Error('Table name must be defined');
    }
  }

  /**
   * Get the table/collection name for this repository
   * Must be implemented by subclasses
   * @returns {string}
   */
  getTableName() {
    throw new Error('getTableName() method must be implemented by subclass');
  }

  /**
   * Validate data before operations
   * Can be overridden by subclasses for custom validation
   * @param {Object} data - Data to validate
   * @param {string} operation - Operation type ('create', 'update')
   * @returns {Object} - Validated data
   */
  validateData(data, operation = 'create') {
    if (!data || typeof data !== 'object') {
      throw new Error('Data must be a valid object');
    }
    return data;
  }

  /**
   * Transform data before saving
   * Can be overridden by subclasses for custom transformations
   * @param {Object} data - Data to transform
   * @param {string} operation - Operation type ('create', 'update')
   * @returns {Object} - Transformed data
   */
  transformDataForSave(data, operation = 'create') {
    const transformed = { ...data };
    
    // Add timestamps for creation
    if (operation === 'create') {
      const now = new Date();
      if (!transformed.createdAt) {
        transformed.createdAt = now;
      }
      if (!transformed.updatedAt) {
        transformed.updatedAt = now;
      }
    }
    
    // Update timestamp for updates
    if (operation === 'update') {
      transformed.updatedAt = new Date();
    }
    
    return transformed;
  }

  /**
   * Transform data after loading
   * Can be overridden by subclasses for custom transformations
   * @param {Object} data - Data to transform
   * @returns {Object} - Transformed data
   */
  transformDataAfterLoad(data) {
    if (!data) return null;
    return data;
  }

  /**
   * Find a single record by ID
   * @param {string} id - Record ID
   * @returns {Promise<Object|null>}
   */
  async findById(id) {
    try {
      if (!id) {
        throw new Error('ID is required');
      }
      
      const result = await this.adapter.findById(this.tableName, id);
      return this.transformDataAfterLoad(result);
    } catch (error) {
      logger.error(`Error finding by ID in ${this.tableName}:`, error);
      throw error;
    }
  }

  /**
   * Find multiple records with optional query and options
   * @param {Object} query - Query conditions
   * @param {Object} options - Query options (sort, limit, skip, populate, select)
   * @returns {Promise<Array>}
   */
  async findMany(query = {}, options = {}) {
    try {
      const results = await this.adapter.findMany(this.tableName, query, options);
      return results.map(result => this.transformDataAfterLoad(result));
    } catch (error) {
      logger.error(`Error finding many in ${this.tableName}:`, error);
      throw error;
    }
  }

  /**
   * Find a single record with query
   * @param {Object} query - Query conditions
   * @param {Object} options - Query options
   * @returns {Promise<Object|null>}
   */
  async findOne(query, options = {}) {
    try {
      const result = await this.adapter.findOne(this.tableName, query, options);
      return this.transformDataAfterLoad(result);
    } catch (error) {
      logger.error(`Error finding one in ${this.tableName}:`, error);
      throw error;
    }
  }

  /**
   * Create a new record
   * @param {Object} data - Data to insert
   * @returns {Promise<Object>}
   */
  async create(data) {
    try {
      const validatedData = this.validateData(data, 'create');
      const transformedData = this.transformDataForSave(validatedData, 'create');
      
      const result = await this.adapter.create(this.tableName, transformedData);
      return this.transformDataAfterLoad(result);
    } catch (error) {
      logger.error(`Error creating in ${this.tableName}:`, error);
      throw error;
    }
  }

  /**
   * Create multiple records
   * @param {Array} dataArray - Array of data to insert
   * @returns {Promise<Array>}
   */
  async createMany(dataArray) {
    try {
      if (!Array.isArray(dataArray)) {
        throw new Error('Data must be an array');
      }
      
      const processedData = dataArray.map(data => {
        const validatedData = this.validateData(data, 'create');
        return this.transformDataForSave(validatedData, 'create');
      });
      
      const results = await this.adapter.createMany(this.tableName, processedData);
      return results.map(result => this.transformDataAfterLoad(result));
    } catch (error) {
      logger.error(`Error creating many in ${this.tableName}:`, error);
      throw error;
    }
  }

  /**
   * Update a record by ID
   * @param {string} id - Record ID
   * @param {Object} data - Data to update
   * @returns {Promise<Object|null>}
   */
  async updateById(id, data) {
    try {
      if (!id) {
        throw new Error('ID is required');
      }
      
      const validatedData = this.validateData(data, 'update');
      const transformedData = this.transformDataForSave(validatedData, 'update');
      
      const result = await this.adapter.updateById(this.tableName, id, transformedData);
      return this.transformDataAfterLoad(result);
    } catch (error) {
      logger.error(`Error updating by ID in ${this.tableName}:`, error);
      throw error;
    }
  }

  /**
   * Update multiple records
   * @param {Object} query - Query conditions
   * @param {Object} data - Data to update
   * @returns {Promise<Object>} - Update result with count
   */
  async updateMany(query, data) {
    try {
      const validatedData = this.validateData(data, 'update');
      const transformedData = this.transformDataForSave(validatedData, 'update');
      
      return await this.adapter.updateMany(this.tableName, query, transformedData);
    } catch (error) {
      logger.error(`Error updating many in ${this.tableName}:`, error);
      throw error;
    }
  }

  /**
   * Delete a record by ID
   * @param {string} id - Record ID
   * @returns {Promise<boolean>}
   */
  async deleteById(id) {
    try {
      if (!id) {
        throw new Error('ID is required');
      }
      
      return await this.adapter.deleteById(this.tableName, id);
    } catch (error) {
      logger.error(`Error deleting by ID in ${this.tableName}:`, error);
      throw error;
    }
  }

  /**
   * Delete multiple records
   * @param {Object} query - Query conditions
   * @returns {Promise<Object>} - Delete result with count
   */
  async deleteMany(query) {
    try {
      return await this.adapter.deleteMany(this.tableName, query);
    } catch (error) {
      logger.error(`Error deleting many in ${this.tableName}:`, error);
      throw error;
    }
  }

  /**
   * Count records matching query
   * @param {Object} query - Query conditions
   * @returns {Promise<number>}
   */
  async count(query = {}) {
    try {
      return await this.adapter.count(this.tableName, query);
    } catch (error) {
      logger.error(`Error counting in ${this.tableName}:`, error);
      throw error;
    }
  }

  /**
   * Execute aggregation pipeline
   * @param {Array} pipeline - Aggregation pipeline
   * @returns {Promise<Array>}
   */
  async aggregate(pipeline) {
    try {
      const results = await this.adapter.aggregate(this.tableName, pipeline);
      return results.map(result => this.transformDataAfterLoad(result));
    } catch (error) {
      logger.error(`Error aggregating in ${this.tableName}:`, error);
      throw error;
    }
  }

  /**
   * Find records with pagination
   * @param {Object} query - Query conditions
   * @param {Object} options - Options including page, limit, sort
   * @returns {Promise<Object>} - Paginated results with metadata
   */
  async paginate(query = {}, options = {}) {
    try {
      const {
        page = 1,
        limit = 10,
        sort = {},
        ...otherOptions
      } = options;

      const skip = (page - 1) * limit;
      
      // Get total count
      const total = await this.count(query);
      
      // Get paginated results
      const results = await this.findMany(query, {
        ...otherOptions,
        sort,
        limit,
        skip
      });

      return {
        data: results,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
          hasNext: page * limit < total,
          hasPrev: page > 1
        }
      };
    } catch (error) {
      logger.error(`Error paginating in ${this.tableName}:`, error);
      throw error;
    }
  }

  /**
   * Check if a record exists
   * @param {Object} query - Query conditions
   * @returns {Promise<boolean>}
   */
  async exists(query) {
    try {
      const count = await this.count(query);
      return count > 0;
    } catch (error) {
      logger.error(`Error checking existence in ${this.tableName}:`, error);
      throw error;
    }
  }

  /**
   * Find or create a record
   * @param {Object} query - Query conditions to find
   * @param {Object} data - Data to create if not found
   * @returns {Promise<{record: Object, created: boolean}>}
   */
  async findOrCreate(query, data) {
    try {
      let record = await this.findOne(query);
      let created = false;
      
      if (!record) {
        record = await this.create({ ...query, ...data });
        created = true;
      }
      
      return { record, created };
    } catch (error) {
      logger.error(`Error in findOrCreate for ${this.tableName}:`, error);
      throw error;
    }
  }
}

module.exports = BaseRepository;
