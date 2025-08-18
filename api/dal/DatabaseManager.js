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
   * @returns {Promise<void>}
   */
  async initialize() {
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

      // Initialize repositories
      this.initializeRepositories();

      this.isInitialized = true;
      logger.info(`DatabaseManager initialized successfully with ${dbType} adapter`);
    } catch (error) {
      logger.error('DatabaseManager initialization failed:', error);
      throw error;
    }
  }

  /**
   * Initialize all repositories with the current adapter
   */
  initializeRepositories() {
    try {
      this.repositories.user = new UserRepository(this.adapter);
      this.repositories.message = new MessageRepository(this.adapter);
      this.repositories.conversation = new ConversationRepository(this.adapter);
      this.repositories.agent = new AgentRepository(this.adapter);
      this.repositories.file = new FileRepository(this.adapter);
      this.repositories.preset = new PresetRepository(this.adapter);
      this.repositories.session = new SessionRepository(this.adapter);
      this.repositories.balance = new BalanceRepository(this.adapter);
      this.repositories.pluginAuth = new PluginAuthRepository(this.adapter);
      this.repositories.key = new KeyRepository(this.adapter);
      this.repositories.role = new RoleRepository(this.adapter);
      this.repositories.permission = new PermissionRepository(this.adapter);
      this.repositories.tool = new ToolRepository(this.adapter);
      this.repositories.action = new ActionRepository(this.adapter);
      this.repositories.prompt = new PromptRepository(this.adapter);

      logger.info('All repositories initialized successfully');
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
   * Health check for the database connection
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

      return {
        status: isConnected ? 'healthy' : 'unhealthy',
        databaseType,
        isConnected,
        repositoryCount: Object.keys(this.repositories).length,
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
}

// Export singleton instance
const databaseManager = new DatabaseManager();

module.exports = {
  DatabaseManager,
  databaseManager
};
