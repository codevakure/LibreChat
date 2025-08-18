/**
 * Database Abstraction Layer (DAL) - Main Export
 * Provides a unified interface for database operations across different database types
 */

// Core components
const { DatabaseManager, databaseManager } = require('./DatabaseManager');

// Adapters
const BaseAdapter = require('./adapters/BaseAdapter');
const MongoAdapter = require('./adapters/MongoAdapter');
const PostgresAdapter = require('./adapters/PostgresAdapter');

// Repositories
const BaseRepository = require('./repositories/BaseRepository');
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
 * Initialize the Database Abstraction Layer
 * This should be called once during application startup
 * @returns {Promise<void>}
 */
async function initializeDAL() {
  await databaseManager.initialize();
}

/**
 * Get a repository instance
 * @param {string} repositoryName - Name of the repository
 * @returns {BaseRepository} - Repository instance
 */
function getRepository(repositoryName) {
  return databaseManager.getRepository(repositoryName);
}

/**
 * Get the current database adapter
 * @returns {BaseAdapter} - Database adapter instance
 */
function getAdapter() {
  return databaseManager.getAdapter();
}

/**
 * Get the current database type
 * @returns {string} - Database type ('mongodb' or 'postgresql')
 */
function getDatabaseType() {
  return databaseManager.getDatabaseType();
}

/**
 * Check if the database is connected
 * @returns {boolean} - Connection status
 */
function isConnected() {
  return databaseManager.isConnected();
}

/**
 * Execute a function within a database transaction
 * @param {Function} fn - Function to execute within transaction
 * @returns {Promise<any>}
 */
async function withTransaction(fn) {
  return await databaseManager.withTransaction(fn);
}

/**
 * Disconnect from the database
 * @returns {Promise<void>}
 */
async function disconnect() {
  await databaseManager.disconnect();
}

/**
 * Get database health status
 * @returns {Promise<Object>} - Health status object
 */
async function healthCheck() {
  return await databaseManager.healthCheck();
}

// Export everything
module.exports = {
  // Core functions
  initializeDAL,
  getRepository,
  getAdapter,
  getDatabaseType,
  isConnected,
  withTransaction,
  disconnect,
  healthCheck,

  // Singleton instance
  databaseManager,

  // Classes for direct usage if needed
  DatabaseManager,

  // Adapters
  BaseAdapter,
  MongoAdapter,
  PostgresAdapter,

  // Repositories
  BaseRepository,
  UserRepository,
  MessageRepository,
  ConversationRepository,
  AgentRepository,
  FileRepository,
  PresetRepository,
  SessionRepository,
  BalanceRepository,
  PluginAuthRepository,
  KeyRepository,
  RoleRepository,
  PermissionRepository,
  ToolRepository,
  ActionRepository,
  PromptRepository,

  // Repository shortcuts
  repositories: {
    user: () => getRepository('user'),
    message: () => getRepository('message'),
    conversation: () => getRepository('conversation'),
    agent: () => getRepository('agent'),
    file: () => getRepository('file'),
    preset: () => getRepository('preset'),
    session: () => getRepository('session'),
    balance: () => getRepository('balance'),
    pluginAuth: () => getRepository('pluginAuth'),
    key: () => getRepository('key'),
    role: () => getRepository('role'),
    permission: () => getRepository('permission'),
    tool: () => getRepository('tool'),
    action: () => getRepository('action'),
    prompt: () => getRepository('prompt')
  }
};
