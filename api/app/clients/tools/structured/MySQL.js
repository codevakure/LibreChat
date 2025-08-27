const { Tool } = require('@langchain/core/tools');
const { z } = require('zod');
const { logger } = require('~/config');

/**
 * MySQL Query Tool for Wrangler Agents
 * Executes SQL queries against MySQL databases
 * Based on Anything LLM's SQL connector implementation
 */
class MySQL extends Tool {
  static lc_name() {
    return 'MySQL';
  }

  constructor(fields = {}) {
    super();
    this.name = 'mysql';
    this.description = 'Execute SQL queries against a MySQL database. Use this tool to retrieve data, analyze database content, and answer questions about MySQL database information. Only SELECT queries are allowed for safety.';

    // Used to initialize the Tool without necessary variables
    this.override = fields.override ?? false;

    // User-configurable fields from the UI (passed through authConfig)
    this.connectionString = fields.MYSQL_CONNECTION_STRING;
    this.host = fields.MYSQL_HOST;
    this.port = fields.MYSQL_PORT || '3306';
    this.database = fields.MYSQL_DATABASE;
    this.username = fields.MYSQL_USERNAME;
    this.password = fields.MYSQL_PASSWORD;
    this.ssl = fields.MYSQL_SSL === 'true' || fields.MYSQL_SSL === true;
    
    // Query limits for safety
    this.maxRows = parseInt(fields.MYSQL_MAX_ROWS || '100');
    this.queryTimeout = parseInt(fields.MYSQL_QUERY_TIMEOUT || '30000');

    // Schema for the tool input
    this.schema = z.object({
      query: z.string().describe('The MySQL query to execute. Should be a SELECT statement for data retrieval. Avoid DROP, DELETE, UPDATE, INSERT operations for safety.'),
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
          'Missing MySQL connection details. Please provide either a connection string or individual connection parameters (host, database, username, password).'
        );
      }
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

    const sslParam = this.ssl ? '?ssl=true' : '';
    return `mysql://${this.username}:${this.password}@${this.host}:${this.port}/${this.database}${sslParam}`;
  }

  // Initialize MySQL client
  _initializeClient() {
    try {
      const mysql = require('mysql2/promise');
      
      let config;
      if (this.connectionString) {
        config = {
          uri: this.connectionString,
          ssl: this.ssl ? { rejectUnauthorized: false } : false,
          connectionLimit: 5,
          acquireTimeout: this.queryTimeout,
          timeout: this.queryTimeout,
        };
      } else {
        config = {
          host: this.host,
          port: this.port,
          database: this.database,
          user: this.username,
          password: this.password,
          ssl: this.ssl ? { rejectUnauthorized: false } : false,
          connectionLimit: 5,
          acquireTimeout: this.queryTimeout,
          timeout: this.queryTimeout,
        };
      }

      this.pool = mysql.createPool(config);
      
      // Test connection
      this.pool.execute('SELECT 1').catch((error) => {
        logger.error('MySQL connection test failed:', error);
      });
      
    } catch (error) {
      logger.error('Failed to initialize MySQL client:', error);
      throw new Error('Failed to initialize MySQL client. Make sure mysql2 package is installed.');
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
      return 'MySQL tool is not configured. Please provide valid MySQL connection details.';
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

      logger.info(`Executing MySQL query: ${finalQuery.substring(0, 100)}...`);

      // Execute query with timeout
      const [rows, fields] = await Promise.race([
        this.pool.execute(finalQuery),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Query timeout')), this.queryTimeout)
        ),
      ]);

      // Format results
      const formattedResult = this._formatResults({ rows, fields }, finalQuery);
      return formattedResult;

    } catch (error) {
      logger.error('MySQL query error:', error);
      return `Error executing MySQL query: ${error.message}`;
    }
  }

  // Format query results for agent consumption
  _formatResults(result, query) {
    if (!result.rows || result.rows.length === 0) {
      return `Query executed successfully but returned no results.\nQuery: ${query}`;
    }

    const { rows, fields } = result;
    
    // Get column names
    const columns = fields.map(field => field.name);
    
    // Format as a readable table
    let output = `MySQL Query Results (${rows.length} rows):\n\n`;
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
    output += `\nSummary: Retrieved ${rows.length} rows with ${columns.length} columns.`;
    
    return output;
  }

  // Get database schema information
  async getSchema() {
    if (this.override) {
      return 'MySQL tool is not configured.';
    }

    try {
      const schemaQuery = `
        SELECT 
          TABLE_NAME as table_name,
          COLUMN_NAME as column_name,
          DATA_TYPE as data_type,
          IS_NULLABLE as is_nullable,
          COLUMN_DEFAULT as column_default
        FROM information_schema.COLUMNS 
        WHERE TABLE_SCHEMA = ?
        ORDER BY TABLE_NAME, ORDINAL_POSITION
      `;
      
      const [rows] = await this.pool.execute(schemaQuery, [this.database]);
      return this._formatSchemaResults(rows);
      
    } catch (error) {
      logger.error('Error getting MySQL schema:', error);
      return `Error retrieving schema: ${error.message}`;
    }
  }

  // Format schema results
  _formatSchemaResults(rows) {
    if (!rows || rows.length === 0) {
      return 'No tables found in the specified database.';
    }

    let output = `MySQL Database Schema (${this.database}):\n\n`;
    
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
        logger.info('MySQL connection pool closed');
      } catch (error) {
        logger.error('Error closing MySQL pool:', error);
      }
    }
  }
}

module.exports = MySQL;
