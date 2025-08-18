const { logger } = require('@librechat/data-schemas');
const MongoAdapter = require('./adapters/MongoAdapter');
const PostgresAdapter = require('./adapters/PostgresAdapter');

// Import repositories
const UserRepository = require('./repositories/UserRepository');
const MessageRepository = require('./repositories/MessageRepository');
const ConversationRepository = require('./repositories/ConversationRepository');
const AgentRepository = require('./repositories/AgentRepository');
const FileRepository = require('./repositories/FileRepository');
const PresetRepository = require('./repositories/PresetRepository');
const SessionRepository = require('./repositories/SessionRepository');
const BalanceRepository = require('./repositories/BalanceRepository');
const PluginAuthRepository = require('./repositories/PluginAuthRepository');
const KeyRepository = require('./repositories/KeyRepository');
const RoleRepository = require('./repositories/RoleRepository');
const PermissionRepository = require('./repositories/PermissionRepository');
const ToolRepository = require('./repositories/ToolRepository');
const ActionRepository = require('./repositories/ActionRepository');
const PromptRepository = require('./repositories/PromptRepository');

/**
 * Database Manager
 * Central manager for database operations across different database types
 */
class DatabaseManager {
  constructor() {
    this.adapter = null;
    this.repositories = {};
    this.isInitialized = false;
  }

  /**
   * Initialize the database manager
   * @param {Object} config - Configuration object
   * @returns {Promise<void>}
   */
  async initialize(config = {}) {
    if (this.isInitialized) {
      logger.warn('DatabaseManager already initialized');
      return;
    }

    try {
      const dbType = process.env.DATABASE_TYPE || 'mongodb';
      logger.info(`Initializing DatabaseManager with ${dbType} adapter`);

      // Create appropriate adapter
      if (dbType === 'mongodb') {
        this.adapter = new MongoAdapter();
      } else if (dbType === 'postgresql') {
        this.adapter = new PostgresAdapter();
      } else {
        throw new Error(`Unsupported database type: ${dbType}`);
      }

      // Connect to database
      await this.adapter.connect();

      // Initialize repositories with configuration
      this.initializeRepositories(config);

      this.isInitialized = true;
      logger.info(`DatabaseManager initialized successfully with ${dbType} adapter`);
    } catch (error) {
      logger.error('DatabaseManager initialization failed:', error);
      throw error;
    }
  }

  /**
   * Initialize all repositories with the current adapter
   * @param {Object} config - Configuration object
   */
  initializeRepositories(config = {}) {
    try {
      const searchConfig = {
        search: {
          host: config.meilisearch?.host,
          apiKey: config.meilisearch?.apiKey,
          enabled: config.meilisearch?.enabled,
          ...config.search
        }
      };

      this.repositories.user = new UserRepository(this.adapter, searchConfig);
      this.repositories.message = new MessageRepository(this.adapter, searchConfig);
      this.repositories.conversation = new ConversationRepository(this.adapter, searchConfig);
      this.repositories.agent = new AgentRepository(this.adapter, searchConfig);
      this.repositories.file = new FileRepository(this.adapter, searchConfig);
      this.repositories.preset = new PresetRepository(this.adapter, searchConfig);
      this.repositories.session = new SessionRepository(this.adapter);
      this.repositories.balance = new BalanceRepository(this.adapter);
      this.repositories.pluginAuth = new PluginAuthRepository(this.adapter);
      this.repositories.key = new KeyRepository(this.adapter);
      this.repositories.role = new RoleRepository(this.adapter);
      this.repositories.permission = new PermissionRepository(this.adapter);
      this.repositories.tool = new ToolRepository(this.adapter);
      this.repositories.action = new ActionRepository(this.adapter);
      this.repositories.prompt = new PromptRepository(this.adapter, searchConfig);

      logger.info('All repositories initialized successfully with search configuration');
    } catch (error) {
      logger.error('Repository initialization failed:', error);
      throw error;
    }
  }

  /**
   * Get repository by name
   * @param {string} name - Repository name
   * @returns {BaseRepository}
   */
  getRepository(name) {
    if (!this.isInitialized) {
      throw new Error('DatabaseManager not initialized. Call initialize() first.');
    }

    const repository = this.repositories[name];
    if (!repository) {
      throw new Error(`Repository '${name}' not found. Available repositories: ${Object.keys(this.repositories).join(', ')}`);
    }

    return repository;
  }

  /**
   * Get all available repository names
   * @returns {Array<string>}
   */
  getRepositoryNames() {
    return Object.keys(this.repositories);
  }

  /**
   * Get the current database adapter
   * @returns {BaseAdapter}
   */
  getAdapter() {
    if (!this.isInitialized) {
      throw new Error('DatabaseManager not initialized. Call initialize() first.');
    }
    return this.adapter;
  }

  /**
   * Get the current database type
   * @returns {string}
   */
  getDatabaseType() {
    if (!this.isInitialized) {
      throw new Error('DatabaseManager not initialized. Call initialize() first.');
    }
    return this.adapter.getType();
  }

  /**
   * Check if the database is connected
   * @returns {boolean}
   */
  isConnected() {
    return this.isInitialized && this.adapter && this.adapter.isConnected();
  }

  /**
   * Execute a function within a database transaction
   * @param {Function} fn - Function to execute within transaction
   * @returns {Promise<any>}
   */
  async withTransaction(fn) {
    if (!this.isInitialized) {
      throw new Error('DatabaseManager not initialized. Call initialize() first.');
    }
    return await this.adapter.withTransaction(fn);
  }

  /**
   * Disconnect from the database
   * @returns {Promise<void>}
   */
  async disconnect() {
    if (this.adapter) {
      await this.adapter.disconnect();
      this.isInitialized = false;
      logger.info('DatabaseManager disconnected');
    }
  }

  /**
   * Health check for the database connection and search indexing
   * @returns {Promise<Object>}
   */
  async healthCheck() {
    try {
      if (!this.isInitialized) {
        return {
          status: 'error',
          message: 'DatabaseManager not initialized',
          timestamp: new Date().toISOString()
        };
      }

      const isConnected = this.isConnected();
      const databaseType = this.getDatabaseType();
      
      // Check search health if available
      let searchHealth = null;
      try {
        const messageRepo = this.getRepository('message');
        if (messageRepo && messageRepo.searchIndexer) {
          searchHealth = await messageRepo.searchIndexer.healthCheck();
        }
      } catch (error) {
        searchHealth = { status: 'error', message: error.message };
      }

      return {
        status: isConnected ? 'healthy' : 'unhealthy',
        databaseType,
        isConnected,
        repositoryCount: Object.keys(this.repositories).length,
        search: searchHealth,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Database health check failed:', error);
      return {
        status: 'error',
        message: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Sync all collections with search index
   * @param {Object} options - Sync options
   * @returns {Promise<Object>} - Sync results
   */
  async syncSearchIndex(options = {}) {
    if (!this.isInitialized) {
      throw new Error('DatabaseManager not initialized. Call initialize() first.');
    }

    const results = {};
    const repositoriesToSync = ['message', 'conversation', 'file'];

    for (const repoName of repositoriesToSync) {
      try {
        const repo = this.getRepository(repoName);
        if (repo && repo.syncSearchIndex) {
          const indexed = await repo.syncSearchIndex(options);
          results[repoName] = { indexed, status: 'success' };
          logger.info(`Synced ${indexed} documents for ${repoName}`);
        }
      } catch (error) {
        results[repoName] = { error: error.message, status: 'error' };
        logger.error(`Failed to sync ${repoName}:`, error);
      }
    }

    return results;
  }

  /**
   * Get search statistics for all indexed collections
   * @returns {Promise<Object>} - Search statistics
   */
  async getSearchStats() {
    if (!this.isInitialized) {
      throw new Error('DatabaseManager not initialized. Call initialize() first.');
    }

    const stats = {};
    const repositoriesToCheck = ['message', 'conversation', 'file'];

    for (const repoName of repositoriesToCheck) {
      try {
        const repo = this.getRepository(repoName);
        if (repo && repo.getSearchStats) {
          stats[repoName] = await repo.getSearchStats();
        }
      } catch (error) {
        stats[repoName] = { error: error.message };
        logger.error(`Failed to get search stats for ${repoName}:`, error);
      }
    }

    return stats;
  }
}

// Export singleton instance
const databaseManager = new DatabaseManager();

module.exports = {
  DatabaseManager,
  databaseManager
};
