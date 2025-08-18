const BaseRepository = require('./BaseRepository');
const SearchIndexer = require('../plugins/SearchIndexer');

/**
 * File Repository
 * Handles file-specific database operations with search integration
 */
class FileRepository extends BaseRepository {
  constructor(adapter, config = {}) {
    super(adapter);
    this.searchIndexer = new SearchIndexer(adapter, config.search);
  }

  getTableName() {
    return 'files';
  }

  validateData(data, operation = 'create') {
    const validated = super.validateData(data, operation);
    
    if (operation === 'create') {
      if (!validated.filename) {
        throw new Error('Filename is required');
      }
    }
    
    return validated;
  }

  /**
   * Create a new file with search indexing
   * @param {Object} data - File data
   * @returns {Promise<Object>} - Created file
   */
  async create(data) {
    const file = await super.create(data);
    
    // Index the file for search
    if (file) {
      await this.searchIndexer.indexDocument('files', file);
    }
    
    return file;
  }

  /**
   * Update a file with search re-indexing
   * @param {string} id - File ID
   * @param {Object} data - Update data
   * @returns {Promise<Object|null>} - Updated file
   */
  async updateById(id, data) {
    const file = await super.updateById(id, data);
    
    // Re-index the updated file
    if (file) {
      await this.searchIndexer.updateDocument('files', file);
    }
    
    return file;
  }

  /**
   * Delete a file with search index cleanup
   * @param {string} id - File ID
   * @returns {Promise<boolean>} - Success status
   */
  async deleteById(id) {
    const success = await super.deleteById(id);
    
    // Remove from search index
    if (success) {
      await this.searchIndexer.deleteDocument('files', id);
    }
    
    return success;
  }

  async findByUserId(userId, options = {}) {
    return await this.findMany({ user: userId }, options);
  }

  async findByConversationId(conversationId, options = {}) {
    return await this.findMany({ conversationId }, options);
  }

  async findByType(type, options = {}) {
    return await this.findMany({ type }, options);
  }

  /**
   * Search files using MeiliSearch with fallback to database search
   * @param {string} searchTerm - Search term
   * @param {Object} options - Search options
   * @returns {Promise<Array>} - Search results
   */
  async searchFiles(searchTerm, options = {}) {
    if (!searchTerm) {
      return [];
    }

    // Try MeiliSearch first if available
    if (this.searchIndexer.isEnabled()) {
      try {
        const searchResult = await this.searchIndexer.search('files', searchTerm, {
          filter: options.filter,
          limit: options.limit || 20,
          offset: options.offset || 0,
          attributesToHighlight: ['filename', 'type']
        });

        if (searchResult && searchResult.hits) {
          // Get full file objects from database
          const fileIds = searchResult.hits.map(hit => hit.id);
          const files = await this.findMany({ _id: { $in: fileIds } });
          
          // Preserve search ranking order
          const fileMap = new Map(files.map(file => [file._id || file.id, file]));
          return searchResult.hits
            .map(hit => fileMap.get(hit.id))
            .filter(Boolean);
        }
      } catch (error) {
        console.warn('MeiliSearch failed, falling back to database search:', error.message);
      }
    }

    // Fallback to database search
    return await this.searchByFilename(searchTerm, options);
  }

  /**
   * Search files by filename (database fallback)
   * @param {string} searchTerm - Search term
   * @param {Object} options - Query options
   * @returns {Promise<Array>}
   */
  async searchByFilename(searchTerm, options = {}) {
    if (!searchTerm) {
      return [];
    }
    
    const regex = new RegExp(searchTerm, 'i');
    const query = { filename: regex };
    
    if (options.userId) {
      query.user = options.userId;
    }
    
    return await this.findMany(query, options);
  }

  /**
   * Get file statistics for a user
   * @param {string} userId - User ID
   * @returns {Promise<Object>} - File statistics
   */
  async getUserFileStats(userId) {
    if (!userId) {
      throw new Error('User ID is required');
    }

    const pipeline = [
      { $match: { user: userId } },
      {
        $group: {
          _id: null,
          totalFiles: { $sum: 1 },
          totalSize: { $sum: '$bytes' },
          fileTypes: { $addToSet: '$type' },
          embeddedCount: {
            $sum: { $cond: [{ $eq: ['$embedded', true] }, 1, 0] }
          },
          oldestFile: { $min: '$createdAt' },
          newestFile: { $max: '$createdAt' }
        }
      },
      {
        $project: {
          _id: 0,
          totalFiles: 1,
          totalSize: 1,
          uniqueFileTypes: { $size: '$fileTypes' },
          embeddedCount: 1,
          oldestFile: 1,
          newestFile: 1
        }
      }
    ];

    const results = await this.aggregate(pipeline);
    return results.length > 0 ? results[0] : {
      totalFiles: 0,
      totalSize: 0,
      uniqueFileTypes: 0,
      embeddedCount: 0,
      oldestFile: null,
      newestFile: null
    };
  }

  /**
   * Mark file as embedded
   * @param {string} fileId - File ID
   * @returns {Promise<Object|null>}
   */
  async markAsEmbedded(fileId) {
    if (!fileId) {
      throw new Error('File ID is required');
    }
    
    return await this.updateById(fileId, {
      embedded: true,
      embeddedAt: new Date()
    });
  }

  /**
   * Increment file usage count
   * @param {string} fileId - File ID
   * @returns {Promise<Object|null>}
   */
  async incrementUsage(fileId) {
    if (!fileId) {
      throw new Error('File ID is required');
    }
    
    if (this.adapter.getType() === 'mongodb') {
      return await this.updateById(fileId, {
        $inc: { usageCount: 1 }
      });
    } else {
      // For PostgreSQL, we need to handle increment differently
      const file = await this.findById(fileId);
      if (!file) return null;
      
      return await this.updateById(fileId, {
        usageCount: (file.usageCount || 0) + 1
      });
    }
  }

  /**
   * Find files by usage count
   * @param {number} minUsage - Minimum usage count
   * @param {Object} options - Query options
   * @returns {Promise<Array>}
   */
  async findByUsageCount(minUsage = 1, options = {}) {
    return await this.findMany(
      { usageCount: { $gte: minUsage } },
      { sort: { usageCount: -1 }, ...options }
    );
  }

  /**
   * Find unused files
   * @param {Object} options - Query options
   * @returns {Promise<Array>}
   */
  async findUnusedFiles(options = {}) {
    return await this.findMany(
      { 
        $or: [
          { usageCount: { $exists: false } },
          { usageCount: 0 }
        ]
      },
      options
    );
  }

  /**
   * Sync files with search index
   * @param {Object} options - Sync options
   * @returns {Promise<number>} - Number of files indexed
   */
  async syncSearchIndex(options = {}) {
    return await this.searchIndexer.syncCollection('files', options);
  }

  /**
   * Get search index statistics for files
   * @returns {Promise<Object|null>} - Index stats
   */
  async getSearchStats() {
    return await this.searchIndexer.getIndexStats('files');
  }
}

module.exports = FileRepository;
