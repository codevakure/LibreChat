const { Pool } = require('pg');
const fs = require('fs').promises;
const path = require('path');
const { logger } = require('@librechat/data-schemas');

/**
 * PostgreSQL Migration Runner
 * Handles database schema migrations
 */
class MigrationRunner {
  constructor(config = {}) {
    this.config = {
      host: process.env.POSTGRES_HOST || 'localhost',
      port: parseInt(process.env.POSTGRES_PORT) || 5432,
      database: process.env.POSTGRES_DATABASE || 'librechat',
      user: process.env.POSTGRES_USERNAME || 'librechat_user',
      password: process.env.POSTGRES_PASSWORD,
      ssl: process.env.POSTGRES_SSL === 'true' ? { rejectUnauthorized: false } : false,
      ...config
    };
    this.pool = null;
    this.migrationsPath = path.join(__dirname, 'postgresql');
  }

  /**
   * Connect to PostgreSQL
   */
  async connect() {
    if (!this.pool) {
      this.pool = new Pool(this.config);
      
      // Test connection
      const client = await this.pool.connect();
      client.release();
      
      logger.info('Migration runner connected to PostgreSQL');
    }
  }

  /**
   * Disconnect from PostgreSQL
   */
  async disconnect() {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      logger.info('Migration runner disconnected from PostgreSQL');
    }
  }

  /**
   * Check if migrations table exists
   */
  async ensureMigrationsTable() {
    const query = `
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `;
    
    await this.pool.query(query);
  }

  /**
   * Get list of applied migrations
   */
  async getAppliedMigrations() {
    const query = 'SELECT filename FROM migrations ORDER BY applied_at';
    const result = await this.pool.query(query);
    return result.rows.map(row => row.filename);
  }

  /**
   * Get list of available migration files
   */
  async getAvailableMigrations() {
    try {
      const files = await fs.readdir(this.migrationsPath);
      return files
        .filter(file => file.endsWith('.sql'))
        .sort();
    } catch (error) {
      if (error.code === 'ENOENT') {
        logger.warn(`Migrations directory not found: ${this.migrationsPath}`);
        return [];
      }
      throw error;
    }
  }

  /**
   * Read migration file content
   */
  async readMigrationFile(filename) {
    const filePath = path.join(this.migrationsPath, filename);
    return await fs.readFile(filePath, 'utf8');
  }

  /**
   * Execute a single migration
   */
  async executeMigration(filename) {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Read and execute migration SQL
      const sql = await this.readMigrationFile(filename);
      await client.query(sql);
      
      // Record migration as applied
      await client.query(
        'INSERT INTO migrations (filename) VALUES ($1)',
        [filename]
      );
      
      await client.query('COMMIT');
      logger.info(`Migration applied: ${filename}`);
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error(`Migration failed: ${filename}`, error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Run all pending migrations
   */
  async runMigrations() {
    await this.connect();
    await this.ensureMigrationsTable();
    
    const appliedMigrations = await this.getAppliedMigrations();
    const availableMigrations = await this.getAvailableMigrations();
    
    const pendingMigrations = availableMigrations.filter(
      migration => !appliedMigrations.includes(migration)
    );
    
    if (pendingMigrations.length === 0) {
      logger.info('No pending migrations');
      return { applied: 0, migrations: [] };
    }
    
    logger.info(`Found ${pendingMigrations.length} pending migrations`);
    
    const appliedMigrationsList = [];
    for (const migration of pendingMigrations) {
      await this.executeMigration(migration);
      appliedMigrationsList.push(migration);
    }
    
    logger.info(`Applied ${appliedMigrationsList.length} migrations successfully`);
    
    return {
      applied: appliedMigrationsList.length,
      migrations: appliedMigrationsList
    };
  }

  /**
   * Rollback last migration (if supported)
   */
  async rollbackLastMigration() {
    await this.connect();
    
    const query = `
      SELECT filename FROM migrations 
      ORDER BY applied_at DESC 
      LIMIT 1
    `;
    
    const result = await this.pool.query(query);
    
    if (result.rows.length === 0) {
      logger.info('No migrations to rollback');
      return null;
    }
    
    const lastMigration = result.rows[0].filename;
    
    // Look for rollback file
    const rollbackFilename = lastMigration.replace('.sql', '_rollback.sql');
    const rollbackPath = path.join(this.migrationsPath, rollbackFilename);
    
    try {
      const rollbackSQL = await fs.readFile(rollbackPath, 'utf8');
      
      const client = await this.pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(rollbackSQL);
        await client.query(
          'DELETE FROM migrations WHERE filename = $1',
          [lastMigration]
        );
        await client.query('COMMIT');
        
        logger.info(`Rolled back migration: ${lastMigration}`);
        return lastMigration;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      if (error.code === 'ENOENT') {
        logger.error(`Rollback file not found: ${rollbackFilename}`);
        throw new Error(`No rollback script available for ${lastMigration}`);
      }
      throw error;
    }
  }

  /**
   * Get migration status
   */
  async getMigrationStatus() {
    await this.connect();
    
    try {
      await this.ensureMigrationsTable();
      
      const appliedMigrations = await this.getAppliedMigrations();
      const availableMigrations = await this.getAvailableMigrations();
      
      const pendingMigrations = availableMigrations.filter(
        migration => !appliedMigrations.includes(migration)
      );
      
      return {
        applied: appliedMigrations,
        pending: pendingMigrations,
        total: availableMigrations.length,
        appliedCount: appliedMigrations.length,
        pendingCount: pendingMigrations.length
      };
    } catch (error) {
      logger.error('Error getting migration status:', error);
      throw error;
    }
  }

  /**
   * Check if database is ready (all migrations applied)
   */
  async isDatabaseReady() {
    try {
      const status = await this.getMigrationStatus();
      return status.pendingCount === 0;
    } catch (error) {
      logger.error('Error checking database readiness:', error);
      return false;
    }
  }
}

/**
 * Singleton instance
 */
let migrationRunner = null;

/**
 * Get migration runner instance
 */
function getMigrationRunner(config = {}) {
  if (!migrationRunner) {
    migrationRunner = new MigrationRunner(config);
  }
  return migrationRunner;
}

/**
 * Run migrations (convenience function)
 */
async function runMigrations(config = {}) {
  const runner = getMigrationRunner(config);
  try {
    return await runner.runMigrations();
  } finally {
    await runner.disconnect();
  }
}

/**
 * Get migration status (convenience function)
 */
async function getMigrationStatus(config = {}) {
  const runner = getMigrationRunner(config);
  try {
    return await runner.getMigrationStatus();
  } finally {
    await runner.disconnect();
  }
}

module.exports = {
  MigrationRunner,
  getMigrationRunner,
  runMigrations,
  getMigrationStatus
};
