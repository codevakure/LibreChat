// MemoryEntryRepository.js - AI memory management repository
const BaseRepository = require('./BaseRepository');

class MemoryEntryRepository extends BaseRepository {
  constructor(adapter) {
    super(adapter, 'memory_entries');
  }

  /**
   * Find memory entries by user
   * @param {string} user - User ID
   * @returns {Promise<Array>}
   */
  async findByUser(user) {
    try {
      return await this.adapter.find(this.collection, { user }, { created_at: -1 });
    } catch (error) {
      throw new Error(`Failed to find memory entries by user: ${error.message}`);
    }
  }

  /**
   * Search memory entries by content
   * @param {string} user - User ID
   * @param {string} searchTerm - Search term
   * @returns {Promise<Array>}
   */
  async searchByContent(user, searchTerm) {
    try {
      return await this.adapter.find(this.collection, { 
        user,
        content: { $regex: searchTerm, $options: 'i' }
      }, { created_at: -1 });
    } catch (error) {
      throw new Error(`Failed to search memory entries: ${error.message}`);
    }
  }

  /**
   * Find recent memory entries by user
   * @param {string} user - User ID
   * @param {number} limit - Number of entries to return
   * @returns {Promise<Array>}
   */
  async findRecentByUser(user, limit = 10) {
    try {
      return await this.adapter.find(
        this.collection, 
        { user }, 
        { created_at: -1 },
        limit
      );
    } catch (error) {
      throw new Error(`Failed to find recent memory entries: ${error.message}`);
    }
  }

  /**
   * Find memory entries by metadata
   * @param {string} user - User ID
   * @param {Object} metadata - Metadata to match
   * @returns {Promise<Array>}
   */
  async findByMetadata(user, metadata) {
    try {
      const query = { user };
      Object.keys(metadata).forEach(key => {
        query[`metadata.${key}`] = metadata[key];
      });
      return await this.adapter.find(this.collection, query, { created_at: -1 });
    } catch (error) {
      throw new Error(`Failed to find memory entries by metadata: ${error.message}`);
    }
  }

  /**
   * Update memory entry content
   * @param {string} id - Memory entry ID
   * @param {string} content - New content
   * @returns {Promise<Object|null>}
   */
  async updateContent(id, content) {
    try {
      return await this.adapter.updateOne(
        this.collection,
        { [this.adapter.getIdField()]: id },
        { content, updated_at: new Date() }
      );
    } catch (error) {
      throw new Error(`Failed to update memory entry content: ${error.message}`);
    }
  }

  /**
   * Delete old memory entries for user
   * @param {string} user - User ID
   * @param {Date} olderThan - Delete entries older than this date
   * @returns {Promise<number>} Number of deleted entries
   */
  async deleteOldEntries(user, olderThan) {
    try {
      const result = await this.adapter.deleteMany(this.collection, { 
        user,
        created_at: { $lt: olderThan }
      });
      return result.deletedCount || 0;
    } catch (error) {
      throw new Error(`Failed to delete old memory entries: ${error.message}`);
    }
  }

  /**
   * Get memory statistics for user
   * @param {string} user - User ID
   * @returns {Promise<Object>}
   */
  async getMemoryStats(user) {
    try {
      const entries = await this.adapter.find(this.collection, { user });
      return {
        totalEntries: entries.length,
        totalContentLength: entries.reduce((total, entry) => total + entry.content.length, 0),
        oldestEntry: entries.length > 0 ? entries.reduce((oldest, entry) => 
          new Date(entry.created_at) < new Date(oldest.created_at) ? entry : oldest
        ) : null,
        newestEntry: entries.length > 0 ? entries.reduce((newest, entry) => 
          new Date(entry.created_at) > new Date(newest.created_at) ? entry : newest
        ) : null
      };
    } catch (error) {
      throw new Error(`Failed to get memory statistics: ${error.message}`);
    }
  }

  /**
   * Validate memory entry data
   * @param {Object} data - Memory entry data to validate
   * @returns {Object} Validated data
   */
  validateData(data) {
    const errors = [];

    // User validation
    if (!data.user || typeof data.user !== 'string') {
      errors.push('User is required and must be a string');
    }

    // Content validation
    if (!data.content || typeof data.content !== 'string') {
      errors.push('Content is required and must be a string');
    }

    // Metadata validation
    if (data.metadata && typeof data.metadata !== 'object') {
      errors.push('Metadata must be an object');
    }

    if (errors.length > 0) {
      throw new Error(`Validation failed: ${errors.join(', ')}`);
    }

    return {
      ...data,
      metadata: data.metadata || {},
      created_at: data.created_at || new Date(),
      updated_at: new Date()
    };
  }
}

module.exports = MemoryEntryRepository;
