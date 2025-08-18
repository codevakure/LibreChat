const { MeiliSearch } = require('meilisearch');

/**
 * Search Indexer
 * Database-agnostic search indexing with MeiliSearch integration
 */
class SearchIndexer {
  constructor(adapter, config = {}) {
    this.adapter = adapter;
    this.config = {
      host: config.host || process.env.MEILISEARCH_HOST || 'http://localhost:7700',
      apiKey: config.apiKey || process.env.MEILISEARCH_API_KEY,
      enabled: config.enabled !== false && process.env.MEILISEARCH_ENABLED !== 'false',
      ...config
    };
    
    this.client = null;
    this.indices = new Map();
    
    if (this.config.enabled) {
      this.initializeClient();
    }
  }

  /**
   * Initialize MeiliSearch client
   */
  initializeClient() {
    try {
      this.client = new MeiliSearch({
        host: this.config.host,
        apiKey: this.config.apiKey
      });
    } catch (error) {
      console.warn('Failed to initialize MeiliSearch client:', error.message);
      this.config.enabled = false;
    }
  }

  /**
   * Get or create an index for a collection
   * @param {string} collection - Collection/table name
   * @returns {Promise<Object>} - MeiliSearch index
   */
  async getIndex(collection) {
    if (!this.isEnabled()) {
      return null;
    }

    if (this.indices.has(collection)) {
      return this.indices.get(collection);
    }

    try {
      const index = this.client.index(collection);
      
      // Configure searchable attributes based on collection type
      const searchableAttributes = this.getSearchableAttributes(collection);
      if (searchableAttributes.length > 0) {
        await index.updateSearchableAttributes(searchableAttributes);
      }

      // Configure filterable attributes
      const filterableAttributes = this.getFilterableAttributes(collection);
      if (filterableAttributes.length > 0) {
        await index.updateFilterableAttributes(filterableAttributes);
      }

      // Configure sortable attributes
      const sortableAttributes = this.getSortableAttributes(collection);
      if (sortableAttributes.length > 0) {
        await index.updateSortableAttributes(sortableAttributes);
      }

      this.indices.set(collection, index);
      return index;
    } catch (error) {
      console.error(`Failed to get/create index for ${collection}:`, error.message);
      return null;
    }
  }

  /**
   * Get searchable attributes for a collection
   * @param {string} collection - Collection name
   * @returns {Array<string>} - Searchable attributes
   */
  getSearchableAttributes(collection) {
    const attributeMap = {
      conversations: ['title', 'tags'],
      messages: ['text', 'content'],
      files: ['filename', 'type'],
      users: ['username', 'name', 'email'],
      assistants: ['name', 'description', 'instructions'],
      agents: ['name', 'description', 'instructions'],
      prompts: ['title', 'prompt']
    };

    return attributeMap[collection] || [];
  }

  /**
   * Get filterable attributes for a collection
   * @param {string} collection - Collection name
   * @returns {Array<string>} - Filterable attributes
   */
  getFilterableAttributes(collection) {
    const attributeMap = {
      conversations: ['user', 'endpoint', 'archived', 'pinned'],
      messages: ['user', 'conversationId', 'sender', 'model', 'endpoint'],
      files: ['user', 'type', 'embedded'],
      users: ['role', 'provider'],
      assistants: ['author', 'provider'],
      agents: ['author', 'provider'],
      prompts: ['category', 'folderId']
    };

    return attributeMap[collection] || [];
  }

  /**
   * Get sortable attributes for a collection
   * @param {string} collection - Collection name
   * @returns {Array<string>} - Sortable attributes
   */
  getSortableAttributes(collection) {
    const attributeMap = {
      conversations: ['createdAt', 'updatedAt', 'title'],
      messages: ['createdAt', 'updatedAt'],
      files: ['createdAt', 'updatedAt', 'filename'],
      users: ['createdAt', 'username'],
      assistants: ['createdAt', 'name'],
      agents: ['createdAt', 'name'],
      prompts: ['createdAt', 'title']
    };

    return attributeMap[collection] || ['createdAt'];
  }

  /**
   * Prepare document for indexing
   * @param {string} collection - Collection name
   * @param {Object} document - Document to index
   * @returns {Object} - Prepared document
   */
  prepareForIndexing(collection, document) {
    const baseData = {
      id: document._id || document.id,
      createdAt: document.createdAt || document.created_at,
      updatedAt: document.updatedAt || document.updated_at
    };

    // Collection-specific preparation
    switch (collection) {
      case 'conversations':
        return {
          ...baseData,
          title: document.title,
          user: document.user,
          endpoint: document.endpoint,
          tags: document.tags || [],
          archived: document.archived || false,
          pinned: document.pinned || false,
          messageCount: document.messageCount || 0
        };

      case 'messages':
        return {
          ...baseData,
          text: document.text,
          content: typeof document.content === 'string' ? document.content : JSON.stringify(document.content),
          conversationId: document.conversationId || document.conversation_id,
          user: document.user,
          sender: document.sender,
          model: document.model,
          endpoint: document.endpoint,
          tokenCount: document.tokenCount || document.token_count || 0
        };

      case 'files':
        return {
          ...baseData,
          filename: document.filename,
          type: document.type,
          user: document.user,
          bytes: document.bytes || 0,
          embedded: document.embedded || false
        };

      case 'users':
        return {
          ...baseData,
          username: document.username,
          name: document.name,
          email: document.email,
          role: document.role,
          provider: document.provider
        };

      default:
        return baseData;
    }
  }

  /**
   * Index a single document
   * @param {string} collection - Collection name
   * @param {Object} document - Document to index
   * @returns {Promise<Object|null>} - Index result
   */
  async indexDocument(collection, document) {
    if (!this.isEnabled()) {
      return null;
    }

    try {
      const index = await this.getIndex(collection);
      if (!index) {
        return null;
      }

      const indexableData = this.prepareForIndexing(collection, document);
      const result = await index.addDocuments([indexableData]);
      
      // Mark as indexed in the database
      await this.markAsIndexed(collection, document._id || document.id);
      
      return result;
    } catch (error) {
      console.error(`Failed to index document in ${collection}:`, error.message);
      return null;
    }
  }

  /**
   * Index multiple documents
   * @param {string} collection - Collection name
   * @param {Array} documents - Documents to index
   * @returns {Promise<Object|null>} - Index result
   */
  async indexDocuments(collection, documents) {
    if (!this.isEnabled() || !documents.length) {
      return null;
    }

    try {
      const index = await this.getIndex(collection);
      if (!index) {
        return null;
      }

      const indexableData = documents.map(doc => this.prepareForIndexing(collection, doc));
      const result = await index.addDocuments(indexableData);
      
      // Mark all as indexed
      const documentIds = documents.map(doc => doc._id || doc.id);
      await this.markMultipleAsIndexed(collection, documentIds);
      
      return result;
    } catch (error) {
      console.error(`Failed to index documents in ${collection}:`, error.message);
      return null;
    }
  }

  /**
   * Update a document in the index
   * @param {string} collection - Collection name
   * @param {Object} document - Document to update
   * @returns {Promise<Object|null>} - Update result
   */
  async updateDocument(collection, document) {
    return await this.indexDocument(collection, document);
  }

  /**
   * Delete a document from the index
   * @param {string} collection - Collection name
   * @param {string} documentId - Document ID to delete
   * @returns {Promise<Object|null>} - Delete result
   */
  async deleteDocument(collection, documentId) {
    if (!this.isEnabled()) {
      return null;
    }

    try {
      const index = await this.getIndex(collection);
      if (!index) {
        return null;
      }

      return await index.deleteDocument(documentId);
    } catch (error) {
      console.error(`Failed to delete document ${documentId} from ${collection}:`, error.message);
      return null;
    }
  }

  /**
   * Search documents
   * @param {string} collection - Collection name
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Promise<Object|null>} - Search results
   */
  async search(collection, query, options = {}) {
    if (!this.isEnabled()) {
      return null;
    }

    try {
      const index = await this.getIndex(collection);
      if (!index) {
        return null;
      }

      const searchOptions = {
        limit: options.limit || 20,
        offset: options.offset || 0,
        filter: options.filter,
        sort: options.sort,
        attributesToRetrieve: options.attributesToRetrieve,
        attributesToHighlight: options.attributesToHighlight,
        ...options
      };

      return await index.search(query, searchOptions);
    } catch (error) {
      console.error(`Failed to search in ${collection}:`, error.message);
      return null;
    }
  }

  /**
   * Sync a collection - index all unindexed documents
   * @param {string} collection - Collection name
   * @param {Object} options - Sync options
   * @returns {Promise<number>} - Number of documents indexed
   */
  async syncCollection(collection, options = {}) {
    if (!this.isEnabled()) {
      return 0;
    }

    try {
      const batchSize = options.batchSize || 100;
      let indexed = 0;
      let offset = 0;

      while (true) {
        const unindexedDocs = await this.getUnindexedDocuments(collection, {
          limit: batchSize,
          offset
        });

        if (unindexedDocs.length === 0) {
          break;
        }

        await this.indexDocuments(collection, unindexedDocs);
        indexed += unindexedDocs.length;
        offset += batchSize;

        // Add a small delay to prevent overwhelming the system
        if (options.delay) {
          await new Promise(resolve => setTimeout(resolve, options.delay));
        }
      }

      return indexed;
    } catch (error) {
      console.error(`Failed to sync collection ${collection}:`, error.message);
      return 0;
    }
  }

  /**
   * Get unindexed documents from the database
   * @param {string} collection - Collection name
   * @param {Object} options - Query options
   * @returns {Promise<Array>} - Unindexed documents
   */
  async getUnindexedDocuments(collection, options = {}) {
    try {
      const query = {
        $or: [
          { indexed: { $exists: false } },
          { indexed: false }
        ]
      };

      return await this.adapter.findMany(collection, query, options);
    } catch (error) {
      console.error(`Failed to get unindexed documents from ${collection}:`, error.message);
      return [];
    }
  }

  /**
   * Mark a document as indexed
   * @param {string} collection - Collection name
   * @param {string} documentId - Document ID
   * @returns {Promise<boolean>} - Success status
   */
  async markAsIndexed(collection, documentId) {
    try {
      await this.adapter.updateById(collection, documentId, {
        indexed: true,
        indexedAt: new Date()
      });
      return true;
    } catch (error) {
      console.error(`Failed to mark document ${documentId} as indexed:`, error.message);
      return false;
    }
  }

  /**
   * Mark multiple documents as indexed
   * @param {string} collection - Collection name
   * @param {Array} documentIds - Document IDs
   * @returns {Promise<boolean>} - Success status
   */
  async markMultipleAsIndexed(collection, documentIds) {
    try {
      await this.adapter.updateMany(
        collection,
        { _id: { $in: documentIds } },
        {
          indexed: true,
          indexedAt: new Date()
        }
      );
      return true;
    } catch (error) {
      console.error('Failed to mark multiple documents as indexed:', error.message);
      return false;
    }
  }

  /**
   * Check if search indexing is enabled
   * @returns {boolean} - Enabled status
   */
  isEnabled() {
    return this.config.enabled && this.client !== null;
  }

  /**
   * Get index statistics
   * @param {string} collection - Collection name
   * @returns {Promise<Object|null>} - Index stats
   */
  async getIndexStats(collection) {
    if (!this.isEnabled()) {
      return null;
    }

    try {
      const index = await this.getIndex(collection);
      if (!index) {
        return null;
      }

      const stats = await index.getStats();
      return stats;
    } catch (error) {
      console.error(`Failed to get stats for ${collection}:`, error.message);
      return null;
    }
  }

  /**
   * Clear an index
   * @param {string} collection - Collection name
   * @returns {Promise<boolean>} - Success status
   */
  async clearIndex(collection) {
    if (!this.isEnabled()) {
      return false;
    }

    try {
      const index = await this.getIndex(collection);
      if (!index) {
        return false;
      }

      await index.deleteAllDocuments();
      
      // Reset indexed flags in database
      await this.adapter.updateMany(
        collection,
        {},
        { 
          indexed: false,
          indexedAt: null
        }
      );

      return true;
    } catch (error) {
      console.error(`Failed to clear index for ${collection}:`, error.message);
      return false;
    }
  }

  /**
   * Health check for MeiliSearch
   * @returns {Promise<Object>} - Health status
   */
  async healthCheck() {
    if (!this.isEnabled()) {
      return { status: 'disabled', message: 'MeiliSearch is disabled' };
    }

    try {
      await this.client.health();
      return { status: 'healthy', message: 'MeiliSearch is accessible' };
    } catch (error) {
      return { 
        status: 'unhealthy', 
        message: `MeiliSearch health check failed: ${error.message}` 
      };
    }
  }
}

module.exports = SearchIndexer;
