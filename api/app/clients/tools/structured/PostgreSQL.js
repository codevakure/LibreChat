const { Tool } = require('@langchain/core/tools');
const { z } = require('zod');
const { logger } = require('~/config');

/**
 * PostgreSQL Query Tool for Pleach Agents
 * Executes SQL queries against PostgreSQL databases
 * Based on Anything LLM's SQL connector implementation
 */
class PostgreSQL extends Tool {
  static lc_name() {
    return 'PostgreSQL';
  }

  constructor(fields = {}) {
    super();
    this.name = 'postgresql';
    this.description = 'Execute SQL queries against a PostgreSQL database. Use this tool to retrieve data, analyze database content, and answer questions about PostgreSQL database information. Only SELECT queries are allowed for safety.';

    // Used to initialize the Tool without necessary variables
    this.override = fields.override ?? false;

    // User-configurable fields from the UI (passed through authConfig)
    this.connectionString = fields.POSTGRES_CONNECTION_STRING;
    this.host = fields.POSTGRES_HOST;
    this.port = fields.POSTGRES_PORT || '5432';
    this.database = fields.POSTGRES_DATABASE;
    this.username = fields.POSTGRES_USERNAME;
    this.password = fields.POSTGRES_PASSWORD;
    this.schema = fields.POSTGRES_SCHEMA || 'public';
    this.ssl = fields.POSTGRES_SSL === 'true' || fields.POSTGRES_SSL === true;
    
    // Query limits for safety
    this.maxRows = parseInt(fields.POSTGRES_MAX_ROWS || '100');
    this.queryTimeout = parseInt(fields.POSTGRES_QUERY_TIMEOUT || '30000');

    // Schema for the tool input
    this.schema = z.object({
      query: z.string().describe('The PostgreSQL query to execute. Should be a SELECT statement for data retrieval. Avoid DROP, DELETE, UPDATE, INSERT operations for safety.'),
      limit: z.number().optional().describe('Optional limit for number of rows to return (default: 100, max: 1000)'),
    });

    // Build connection string if not provided
    if (!this.connectionString && !this.override) {
      this.connectionString = this._buildConnectionString();
    }

    // Validate required fields (unless in override mode)
    if (!this.override) {
      if (!this.connectionString && (!this.host || !this.database || !this.username || !this.password)) {
        throw new Error(
          'Missing PostgreSQL connection details. Please provide either a connection string or individual connection parameters (host, database, username, password).'
        );
      }
    }

    // Validation
    if (!this.override && !this.connectionString) {
      throw new Error(
        'Missing required PostgreSQL configuration. Please provide POSTGRES_CONNECTION_STRING or individual connection parameters (POSTGRES_HOST, POSTGRES_DATABASE, POSTGRES_USERNAME, POSTGRES_PASSWORD).',
      );
    }

    // Initialize database client
    if (!this.override) {
      this._initializeClient();
    }
  }

  // Build connection string from individual parameters
  _buildConnectionString() {
    if (!this.host || !this.database || !this.username || !this.password) {
      return null;
    }

    const sslParam = this.ssl ? '?sslmode=require' : '';
    return `postgresql://${this.username}:${this.password}@${this.host}:${this.port}/${this.database}${sslParam}`;
  }

  // Initialize PostgreSQL client
  _initializeClient() {
    try {
      const { Pool } = require('pg');
      
      let config;
      if (this.connectionString) {
        config = {
          connectionString: this.connectionString,
          ssl: this.ssl ? { rejectUnauthorized: false } : false,
          max: 5, // Maximum pool size
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: this.queryTimeout,
        };
      } else {
        config = {
          host: this.host,
          port: this.port,
          database: this.database,
          user: this.username,
          password: this.password,
          ssl: this.ssl ? { rejectUnauthorized: false } : false,
          max: 5,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: this.queryTimeout,
        };
      }

      this.pool = new Pool(config);
      
      // Test connection
      this.pool.query('SELECT 1').catch((error) => {
        logger.error('PostgreSQL connection test failed:', error);
      });
      
    } catch (error) {
      logger.error('Failed to initialize PostgreSQL client:', error);
      throw new Error('Failed to initialize PostgreSQL client. Make sure pg package is installed.');
    }
  }

  // Validate query for safety
  _validateQuery(query) {
    const trimmedQuery = query.trim().toLowerCase();
    
    // Only allow SELECT queries for safety
    if (!trimmedQuery.startsWith('select')) {
      throw new Error('Only SELECT queries are allowed for security reasons.');
    }

    // Block potentially dangerous keywords
    const dangerousKeywords = ['drop', 'delete', 'insert', 'update', 'alter', 'create', 'truncate', 'grant', 'revoke'];
    const queryLower = trimmedQuery.toLowerCase();
    
    for (const keyword of dangerousKeywords) {
      if (queryLower.includes(keyword)) {
        throw new Error(`Query contains potentially dangerous keyword: ${keyword}. Only SELECT queries are allowed.`);
      }
    }

    return true;
  }

  // Execute the SQL query
  async _call(input) {
    if (this.override) {
      return 'PostgreSQL tool is not configured. Please provide valid PostgreSQL connection details.';
    }

    try {
      const { query, limit } = input;
      
      // Validate query
      this._validateQuery(query);
      
      // Apply row limit
      const effectiveLimit = Math.min(limit || this.maxRows, 1000);
      let finalQuery = query;
      
      // Add LIMIT if not present and we have a limit
      if (effectiveLimit && !query.toLowerCase().includes('limit')) {
        finalQuery = `${query} LIMIT ${effectiveLimit}`;
      }

      logger.info(`Executing PostgreSQL query: ${finalQuery.substring(0, 100)}...`);

      // Execute query with timeout
      const client = await this.pool.connect();
      
      try {
        const result = await Promise.race([
          client.query(finalQuery),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Query timeout')), this.queryTimeout)
          ),
        ]);

        // Format results
        const formattedResult = this._formatResults(result, finalQuery);
        return formattedResult;
        
      } finally {
        client.release();
      }

    } catch (error) {
      logger.error('PostgreSQL query error:', error);
      return `Error executing PostgreSQL query: ${error.message}`;
    }
  }

  // Format query results for agent consumption
  _formatResults(result, query) {
    if (!result.rows || result.rows.length === 0) {
      return `Query executed successfully but returned no results.\nQuery: ${query}`;
    }

    const { rows, rowCount, fields } = result;
    
    // Get column names
    const columns = fields.map(field => field.name);
    
    // Format as a readable table
    let output = `PostgreSQL Query Results (${rowCount} rows):\n\n`;
    output += `Query: ${query}\n\n`;
    
    // Create table header
    output += columns.join(' | ') + '\n';
    output += columns.map(() => '---').join(' | ') + '\n';
    
    // Add rows (limit display to prevent overwhelming output)
    const displayRows = Math.min(rows.length, 50);
    for (let i = 0; i < displayRows; i++) {
      const row = rows[i];
      const rowValues = columns.map(col => {
        const value = row[col];
        if (value === null) return 'NULL';
        if (typeof value === 'object') return JSON.stringify(value);
        return String(value);
      });
      output += rowValues.join(' | ') + '\n';
    }
    
    if (rows.length > displayRows) {
      output += `\n... and ${rows.length - displayRows} more rows\n`;
    }
    
    // Add summary
    output += `\nSummary: Retrieved ${rowCount} rows with ${columns.length} columns.`;
    
    return output;
  }

  // Get database schema information
  async getSchema() {
    if (this.override) {
      return 'PostgreSQL tool is not configured.';
    }

    try {
      const schemaQuery = `
        SELECT 
          table_name,
          column_name,
          data_type,
          is_nullable,
          column_default
        FROM information_schema.columns 
        WHERE table_schema = $1
        ORDER BY table_name, ordinal_position
      `;
      
      const client = await this.pool.connect();
      
      try {
        const result = await client.query(schemaQuery, [this.schema]);
        return this._formatSchemaResults(result.rows);
      } finally {
        client.release();
      }
      
    } catch (error) {
      logger.error('Error getting PostgreSQL schema:', error);
      return `Error retrieving schema: ${error.message}`;
    }
  }

  // Format schema results
  _formatSchemaResults(rows) {
    if (!rows || rows.length === 0) {
      return 'No tables found in the specified schema.';
    }

    let output = `PostgreSQL Database Schema (${this.schema}):\n\n`;
    
    // Group by table
    const tables = {};
    rows.forEach(row => {
      if (!tables[row.table_name]) {
        tables[row.table_name] = [];
      }
      tables[row.table_name].push(row);
    });
    
    // Format each table
    Object.keys(tables).forEach(tableName => {
      output += `Table: ${tableName}\n`;
      output += 'Column | Type | Nullable | Default\n';
      output += '--- | --- | --- | ---\n';
      
      tables[tableName].forEach(col => {
        output += `${col.column_name} | ${col.data_type} | ${col.is_nullable} | ${col.column_default || 'NULL'}\n`;
      });
      
      output += '\n';
    });
    
    return output;
  }

  // Cleanup resources
  async cleanup() {
    if (this.pool) {
      try {
        await this.pool.end();
        logger.info('PostgreSQL connection pool closed');
      } catch (error) {
        logger.error('Error closing PostgreSQL pool:', error);
      }
    }
  }
}

module.exports = PostgreSQL;
