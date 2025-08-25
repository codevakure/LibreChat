# SQL Database Tools for Pleach Agents

The SQL Database tools enable AI agents to execute SQL queries against configured databases, providing powerful data retrieval and analysis capabilities. Pleach provides separate tools for PostgreSQL, MySQL, and Microsoft SQL Server, inspired by AnythingLLM's SQL connector and designed specifically for agent use.

## Features

- **Multi-Database Support**: PostgreSQL, MySQL, and Microsoft SQL Server
- **Security-First Design**: Only SELECT and WITH (CTE) queries allowed
- **Automatic Query Limits**: Results are automatically limited to prevent large responses  
- **Connection Pooling**: Efficient database connection management
- **Rich Query Results**: Returns formatted data with column information and sample rows
- **Error Handling**: Comprehensive error handling with user-friendly messages

## Supported Databases

### PostgreSQL
- **Default Port**: 5432
- **Features**: Full PostgreSQL feature support including CTEs, JSON queries, and advanced functions
- **SSL Support**: Configurable SSL connections

### MySQL
- **Default Port**: 3306  
- **Features**: MySQL 5.7+ compatibility with full SQL support
- **SSL Support**: Configurable SSL connections

### Microsoft SQL Server
- **Default Port**: 1433
- **Features**: SQL Server 2016+ compatibility including T-SQL functions
- **SSL Support**: Configurable encryption

## Configuration

### Environment Variables

Configure each database tool using specific environment variables:

#### PostgreSQL Configuration
```bash
POSTGRES_CONNECTION_STRING=postgresql://user:pass@host:port/database
# OR individual parameters:
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DATABASE=your_database
POSTGRES_USERNAME=your_username
POSTGRES_PASSWORD=your_password
POSTGRES_SSL=false               # Enable SSL (true/false)
POSTGRES_MAX_ROWS=100           # Maximum rows per query
POSTGRES_QUERY_TIMEOUT=30000    # Query timeout in milliseconds
```

#### MySQL Configuration
```bash
MYSQL_CONNECTION_STRING=mysql://user:pass@host:port/database
# OR individual parameters:
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_DATABASE=your_database
MYSQL_USERNAME=your_username
MYSQL_PASSWORD=your_password
MYSQL_SSL=false
MYSQL_MAX_ROWS=100
MYSQL_QUERY_TIMEOUT=30000
```

#### SQL Server Configuration
```bash
SQLSERVER_CONNECTION_STRING=mssql://user:pass@host:port/database
# OR individual parameters:
SQLSERVER_HOST=localhost
SQLSERVER_PORT=1433
SQLSERVER_DATABASE=your_database
SQLSERVER_USERNAME=your_username
SQLSERVER_PASSWORD=your_password
SQLSERVER_SSL=false
SQLSERVER_MAX_ROWS=100
SQLSERVER_QUERY_TIMEOUT=30000
```

### Per-User Configuration

Users can also configure their own database connections through the Pleach plugin system using the same field names.

### Docker Environment Configuration

When running Pleach in Docker, use these special hostnames:

```bash
# For databases running on the host machine
POSTGRES_HOST=host.docker.internal
MYSQL_HOST=host.docker.internal
SQLSERVER_HOST=host.docker.internal

# For databases in other Docker containers
POSTGRES_HOST=postgres-container-name
MYSQL_HOST=mysql-container-name
SQLSERVER_HOST=sqlserver-container-name
```

## Installation

### 1. Install Database Drivers

The required database drivers are included in Pleach's dependencies:

```bash
# PostgreSQL driver (pg)
# MySQL driver (mysql2) 
# SQL Server driver (mssql)
# These are automatically installed with Pleach
```

### 2. Enable the Tools

Add the specific database tools to your agent's configuration:

```javascript
// For PostgreSQL
{
  "tools": ["postgresql"],
  // ... other agent settings
}

// For MySQL  
{
  "tools": ["mysql"],
  // ... other agent settings
}

// For SQL Server
{
  "tools": ["sql_server"],
  // ... other agent settings
}

// Or use multiple databases
{
  "tools": ["postgresql", "mysql", "sql_server"],
  // ... other agent settings
}
```

### 3. Configure Database Connection

Set the required environment variables or configure through the UI plugin settings.

## Usage Examples

### Basic Data Retrieval

```sql
-- Get all users
SELECT id, name, email, created_at FROM users LIMIT 10;

-- Get user count by registration date
SELECT DATE(created_at) as registration_date, COUNT(*) as user_count 
FROM users 
GROUP BY DATE(created_at) 
ORDER BY registration_date DESC;
```

### Complex Analytics

```sql
-- Revenue analysis with CTEs
WITH monthly_revenue AS (
  SELECT 
    DATE_TRUNC('month', order_date) as month,
    SUM(total_amount) as revenue
  FROM orders 
  WHERE order_date >= '2024-01-01'
  GROUP BY DATE_TRUNC('month', order_date)
)
SELECT 
  month,
  revenue,
  LAG(revenue) OVER (ORDER BY month) as prev_month_revenue,
  ROUND(((revenue - LAG(revenue) OVER (ORDER BY month)) / LAG(revenue) OVER (ORDER BY month)) * 100, 2) as growth_percentage
FROM monthly_revenue
ORDER BY month;
```

### JSON Data Queries (PostgreSQL)

```sql
-- Query JSON columns
SELECT 
  id, 
  name,
  preferences->>'theme' as user_theme,
  preferences->'notifications'->>'email' as email_notifications
FROM user_profiles 
WHERE preferences->>'language' = 'en';
```

## Security Features

### Query Restrictions

The tool implements several security measures:

1. **Read-Only Operations**: Only SELECT and WITH statements are allowed
2. **Blocked Operations**: INSERT, UPDATE, DELETE, DROP, ALTER, CREATE, TRUNCATE are blocked
3. **Stored Procedure Protection**: EXEC, EXECUTE, and system procedures are blocked
4. **Query Limits**: Automatic LIMIT clauses prevent large result sets

### Safe Query Examples

```sql
-- ✅ Allowed - SELECT with aggregation
SELECT category, COUNT(*) FROM products GROUP BY category;

-- ✅ Allowed - WITH clause (CTE)
WITH top_customers AS (
  SELECT customer_id, SUM(amount) as total
  FROM orders GROUP BY customer_id
)
SELECT * FROM top_customers ORDER BY total DESC LIMIT 5;

-- ❌ Blocked - UPDATE operation
UPDATE users SET email = 'new@email.com' WHERE id = 1;

-- ❌ Blocked - DELETE operation  
DELETE FROM orders WHERE id = 123;
```

## Error Handling

The tool provides detailed error messages for common issues:

- **Connection Errors**: Database connectivity problems
- **Authentication Errors**: Invalid credentials
- **Query Syntax Errors**: Malformed SQL queries
- **Permission Errors**: Insufficient database permissions
- **Security Violations**: Attempted unsafe operations

## Best Practices

### For Users

1. **Start Small**: Begin with simple SELECT queries to understand your data structure
2. **Use LIMIT**: Even though automatic limits are applied, explicit LIMIT clauses help control results
3. **Be Specific**: Use WHERE clauses to filter data and improve performance
4. **Check Schema**: Ask the agent to describe table structures before complex queries

### For Developers

1. **Monitor Query Performance**: Set appropriate query timeouts
2. **Review Database Permissions**: Grant only necessary SELECT permissions to the SQL user
3. **Connection Limits**: Configure appropriate connection pool sizes
4. **Log Query Activity**: Monitor queries for performance and security analysis

## Troubleshooting

### Common Issues

#### Connection Failed
```
Error: Database connection failed
Error: getaddrinfo ENOTFOUND hostname
```
**Solutions**: 
- Verify host, port, database name, and credentials
- If using Docker, ensure hostname resolution (use `host.docker.internal` for local host)
- Check if the database server is running and accessible
- Verify network connectivity and firewall settings

#### Query Timeout
```
Error: Query execution timeout
```
**Solution**: Optimize query or increase SQL_QUERY_TIMEOUT

#### Permission Denied
```
Error: Permission denied for table
```
**Solution**: Grant SELECT permissions to the database user

#### Package Not Found
```
Error: Cannot find module 'pg'
```
**Solution**: Install the required database driver package

### Database-Specific Notes

#### PostgreSQL
- Supports advanced features like JSON queries, CTEs, and window functions
- Recommended for complex analytics and data analysis

#### MySQL
- Good performance for standard SQL operations
- Ensure SQL mode compatibility for complex queries

#### SQL Server
- Use appropriate data types for optimal performance
- Some T-SQL specific functions may not be available

## Performance Considerations

- **Query Complexity**: Complex joins and aggregations may impact performance
- **Result Size**: Large result sets are automatically limited for performance
- **Connection Pooling**: Multiple agents share connection pools efficiently
- **Query Caching**: Consider implementing query result caching for repeated operations

## Integration with Pleach

The SQL Query tool integrates seamlessly with Pleach's agent system:

- **Context Awareness**: The tool provides context about database connection and capabilities
- **Error Reporting**: Detailed error messages help users understand and fix issues
- **Result Formatting**: Query results are formatted for readability in chat interfaces
- **Security Integration**: Leverages Pleach's user authentication and authorization system

## Changelog

### Version 1.0.0
- Initial release with PostgreSQL, MySQL, and SQL Server support
- Security-first design with query restrictions
- Automatic query limits and connection pooling
- Integration with Pleach agent system

## Contributing

To contribute improvements to the SQL Query tool:

1. Follow Pleach's contribution guidelines
2. Test changes against all supported database types
3. Ensure security measures remain intact
4. Update documentation for any new features

## License

This tool is part of Pleach and follows the same licensing terms.
