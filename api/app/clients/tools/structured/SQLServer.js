const { Tool } = require('@langchain/core/tools');
const { z } = require('zod');
const { logger } = require('~/config');

/**
 * SQL Server Query Tool for LibreChat Agents
 * Executes SQL queries against Microsoft SQL Server databases
 * Based on Anything LLM's SQL connector implementation
 */
class SQLServer extends Tool {
  static lc_name() {
    return 'SQLServer';
  }

  constructor(fields = {}) {
    super();
    this.name = 'sql_server';
    this.description = 'Execute SQL queries against a Microsoft SQL Server database. Use this tool to retrieve data, analyze database content, and answer questions about SQL Server database information. Only SELECT queries are allowed for safety.';

    // Used to initialize the Tool without necessary variables
    this.override = fields.override ?? false;

    // Connection parameters
    this.connectionString = fields.SQLSERVER_CONNECTION_STRING;
    this.host = fields.SQLSERVER_HOST;
    this.port = fields.SQLSERVER_PORT || '1433';
    this.database = fields.SQLSERVER_DATABASE;
    this.username = fields.SQLSERVER_USERNAME;
    this.password = fields.SQLSERVER_PASSWORD;
    this.encrypt = fields.SQLSERVER_ENCRYPT === 'true' || fields.SQLSERVER_ENCRYPT === true || fields.SQLSERVER_ENCRYPT !== 'false';
    this.trustServerCertificate = fields.SQLSERVER_TRUST_CERT === 'true' || fields.SQLSERVER_TRUST_CERT === true || fields.SQLSERVER_TRUST_CERT !== 'false';
    
    // Query limits for safety
    this.maxRows = parseInt(fields.SQLSERVER_MAX_ROWS || '100');
    this.queryTimeout = parseInt(fields.SQLSERVER_QUERY_TIMEOUT || '30000');

    // Schema for the tool input
    this.schema = z.object({
      query: z.string().describe('The SQL Server query to execute. Should be a SELECT statement for data retrieval. Avoid DROP, DELETE, UPDATE, INSERT operations for safety.'),
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
          'Missing SQL Server connection details. Please provide either a connection string or individual connection parameters (host, database, username, password).'
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

    const encryptParam = this.encrypt ? 'true' : 'false';
    const trustCertParam = this.trustServerCertificate ? 'true' : 'false';
    return `mssql://${this.username}:${this.password}@${this.host}:${this.port}/${this.database}?encrypt=${encryptParam}&trustServerCertificate=${trustCertParam}`;
  }

  // Initialize SQL Server client
  _initializeClient() {
    try {
      const sql = require('mssql');
      
      let config;
      if (this.connectionString) {
        // Parse connection string for mssql config
        const url = new URL(this.connectionString);
        const params = new URLSearchParams(url.search);
        
        config = {
          server: url.hostname,
          port: parseInt(url.port) || 1433,
          database: url.pathname.replace('/', ''),
          user: url.username,
          password: url.password,
          options: {
            encrypt: params.get('encrypt') === 'true',
            trustServerCertificate: params.get('trustServerCertificate') === 'true',
          },
          pool: {
            max: 5,
            min: 0,
            idleTimeoutMillis: 30000,
          },
          requestTimeout: this.queryTimeout,
        };
      } else {
        config = {
          server: this.host,
          port: parseInt(this.port),
          database: this.database,
          user: this.username,
          password: this.password,
          options: {
            encrypt: this.encrypt,
            trustServerCertificate: this.trustServerCertificate,
          },
          pool: {
            max: 5,
            min: 0,
            idleTimeoutMillis: 30000,
          },
          requestTimeout: this.queryTimeout,
        };
      }

      this.pool = new sql.ConnectionPool(config);
      
      // Test connection
      this.pool.connect().then(() => {
        return this.pool.request().query('SELECT 1');
      }).catch((error) => {
        logger.error('SQL Server connection test failed:', error);
      });
      
    } catch (error) {
      logger.error('Failed to initialize SQL Server client:', error);
      throw new Error('Failed to initialize SQL Server client. Make sure mssql package is installed.');
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
      return 'SQL Server tool is not configured. Please provide valid SQL Server connection details.';
    }

    try {
      const { query, limit } = input;
      
      // Validate query
      this._validateQuery(query);
      
      // Apply row limit using TOP for SQL Server
      const effectiveLimit = Math.min(limit || this.maxRows, 1000);
      let finalQuery = query;
      
      // Add TOP if not present and we have a limit (SQL Server specific)
      if (effectiveLimit && !query.toLowerCase().includes('top') && !query.toLowerCase().includes('limit')) {
        finalQuery = query.replace(/^select\s+/i, `SELECT TOP ${effectiveLimit} `);
      }

      logger.info(`Executing SQL Server query: ${finalQuery.substring(0, 100)}...`);

      // Ensure pool is connected
      if (!this.pool.connected) {
        await this.pool.connect();
      }

      // Execute query with timeout
      const request = this.pool.request();
      const result = await Promise.race([
        request.query(finalQuery),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Query timeout')), this.queryTimeout)
        ),
      ]);

      // Format results
      const formattedResult = this._formatResults(result, finalQuery);
      return formattedResult;

    } catch (error) {
      logger.error('SQL Server query error:', error);
      return `Error executing SQL Server query: ${error.message}`;
    }
  }

  // Format query results for agent consumption
  _formatResults(result, query) {
    if (!result.recordset || result.recordset.length === 0) {
      return `Query executed successfully but returned no results.\nQuery: ${query}`;
    }

    const rows = result.recordset;
    const columns = result.recordset.columns ? Object.keys(result.recordset.columns) : Object.keys(rows[0] || {});
    
    // Format as a readable table
    let output = `SQL Server Query Results (${rows.length} rows):\n\n`;
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
        if (value === null || value === undefined) return 'NULL';
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
      return 'SQL Server tool is not configured.';
    }

    try {
      const schemaQuery = `
        SELECT 
          TABLE_NAME as table_name,
          COLUMN_NAME as column_name,
          DATA_TYPE as data_type,
          IS_NULLABLE as is_nullable,
          COLUMN_DEFAULT as column_default
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_CATALOG = @database
        ORDER BY TABLE_NAME, ORDINAL_POSITION
      `;
      
      if (!this.pool.connected) {
        await this.pool.connect();
      }
      
      const request = this.pool.request();
      request.input('database', this.database);
      const result = await request.query(schemaQuery);
      
      return this._formatSchemaResults(result.recordset);
      
    } catch (error) {
      logger.error('Error getting SQL Server schema:', error);
      return `Error retrieving schema: ${error.message}`;
    }
  }

  // Format schema results
  _formatSchemaResults(rows) {
    if (!rows || rows.length === 0) {
      return 'No tables found in the specified database.';
    }

    let output = `SQL Server Database Schema (${this.database}):\n\n`;
    
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
        await this.pool.close();
        logger.info('SQL Server connection pool closed');
      } catch (error) {
        logger.error('Error closing SQL Server pool:', error);
      }
    }
  }
}

module.exports = SQLServer;
