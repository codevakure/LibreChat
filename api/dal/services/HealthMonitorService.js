// HealthMonitorService.js - Database and System Health Monitoring
const { logger } = require('@librechat/data-schemas');

/**
 * Health Monitor Service for Database and System Monitoring
 * Provides health checks, performance metrics, and system status
 */
class HealthMonitorService {
  constructor(databaseManager) {
    this.databaseManager = databaseManager;
    this.healthStatus = {
      database: 'unknown',
      search: 'unknown',
      system: 'unknown',
      lastCheck: null,
      checks: {
        database: null,
        search: null,
        memory: null,
        disk: null
      }
    };
    
    this.startHealthMonitoring();
  }

  /**
   * Start continuous health monitoring
   */
  startHealthMonitoring() {
    // Run health checks every 30 seconds
    setInterval(async () => {
      try {
        await this.performHealthCheck();
      } catch (error) {
        logger.error('Health check failed:', error);
      }
    }, 30000);

    // Initial health check
    setTimeout(() => this.performHealthCheck(), 5000);
  }

  /**
   * Perform comprehensive health check
   */
  async performHealthCheck() {
    const startTime = Date.now();
    
    try {
      // Database health check
      const dbHealth = await this.checkDatabaseHealth();
      
      // Search health check (if available)
      const searchHealth = await this.checkSearchHealth();
      
      // System health check
      const systemHealth = await this.checkSystemHealth();
      
      // Update health status
      this.healthStatus = {
        database: dbHealth.status,
        search: searchHealth.status,
        system: systemHealth.status,
        lastCheck: new Date().toISOString(),
        duration: Date.now() - startTime,
        checks: {
          database: dbHealth,
          search: searchHealth,
          memory: systemHealth.memory,
          disk: systemHealth.disk
        }
      };

      // Log health status periodically
      if (Math.random() < 0.1) { // 10% chance to log
        logger.info('System Health Check', this.getHealthSummary());
      }

    } catch (error) {
      logger.error('Health check error:', error);
      this.healthStatus.database = 'error';
      this.healthStatus.system = 'error';
      this.healthStatus.lastCheck = new Date().toISOString();
    }
  }

  /**
   * Check database health
   */
  async checkDatabaseHealth() {
    const startTime = Date.now();
    
    try {
      const adapter = this.databaseManager.adapter;
      
      if (!adapter || !adapter.isConnected()) {
        return {
          status: 'down',
          message: 'Database not connected',
          duration: Date.now() - startTime
        };
      }

      // Perform simple query to test database
      if (adapter.getType() === 'postgresql') {
        await adapter.pool.query('SELECT 1');
        
        // Get PostgreSQL-specific metrics
        const metrics = adapter.getPerformanceMetrics();
        return {
          status: 'healthy',
          type: 'postgresql',
          duration: Date.now() - startTime,
          metrics: {
            activeConnections: metrics.activeConnections,
            totalQueries: metrics.totalQueries,
            averageQueryTime: metrics.averageQueryTime,
            errors: metrics.errors,
            slowQueries: metrics.slowQueries,
            poolStats: metrics.poolStats
          }
        };
      } else if (adapter.getType() === 'mongodb') {
        // MongoDB health check
        const db = adapter.getDatabase();
        await db.admin().ping();
        
        return {
          status: 'healthy',
          type: 'mongodb',
          duration: Date.now() - startTime,
          metrics: {
            connections: db.serverConfig?.connections?.length || 0
          }
        };
      }

      return {
        status: 'unknown',
        message: 'Unknown database type',
        duration: Date.now() - startTime
      };

    } catch (error) {
      return {
        status: 'error',
        message: error.message,
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * Check search engine health (MeiliSearch)
   */
  async checkSearchHealth() {
    const startTime = Date.now();
    
    try {
      // Try to get search service health
      const searchService = this.databaseManager.getSearchService?.();
      
      if (!searchService) {
        return {
          status: 'disabled',
          message: 'Search service not configured',
          duration: Date.now() - startTime
        };
      }

      // Test search health
      const health = await searchService.getHealth();
      
      return {
        status: health.status === 'available' ? 'healthy' : 'degraded',
        type: 'meilisearch',
        duration: Date.now() - startTime,
        metrics: health
      };

    } catch (error) {
      return {
        status: 'error',
        message: error.message,
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * Check system health (memory, CPU, disk)
   */
  async checkSystemHealth() {
    const startTime = Date.now();
    
    try {
      const memoryUsage = process.memoryUsage();
      const uptime = process.uptime();
      
      // Memory metrics
      const memoryMetrics = {
        rss: Math.round(memoryUsage.rss / 1024 / 1024), // MB
        heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024), // MB
        heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024), // MB
        external: Math.round(memoryUsage.external / 1024 / 1024), // MB
        uptime: Math.round(uptime / 60) // minutes
      };

      // Disk space check (basic)
      let diskMetrics = null;
      try {
        const fs = require('fs');
        const stats = fs.statSync(process.cwd());
        diskMetrics = {
          available: true,
          path: process.cwd()
        };
      } catch (error) {
        diskMetrics = {
          available: false,
          error: error.message
        };
      }

      // Determine overall system status
      const memoryStatus = memoryMetrics.heapUsed > 1000 ? 'warning' : 'healthy'; // Warning if > 1GB
      const systemStatus = memoryStatus === 'healthy' ? 'healthy' : 'warning';

      return {
        status: systemStatus,
        duration: Date.now() - startTime,
        memory: memoryMetrics,
        disk: diskMetrics
      };

    } catch (error) {
      return {
        status: 'error',
        message: error.message,
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * Get current health status
   */
  getHealthStatus() {
    return this.healthStatus;
  }

  /**
   * Get health summary
   */
  getHealthSummary() {
    return {
      overall: this.getOverallHealth(),
      database: this.healthStatus.database,
      search: this.healthStatus.search,
      system: this.healthStatus.system,
      lastCheck: this.healthStatus.lastCheck,
      duration: this.healthStatus.duration
    };
  }

  /**
   * Get overall health status
   */
  getOverallHealth() {
    const { database, search, system } = this.healthStatus;
    
    if (database === 'error' || system === 'error') {
      return 'unhealthy';
    }
    
    if (database === 'down') {
      return 'down';
    }
    
    if (database === 'healthy' && system === 'healthy') {
      return 'healthy';
    }
    
    return 'degraded';
  }

  /**
   * Get detailed health report
   */
  getDetailedHealthReport() {
    return {
      ...this.healthStatus,
      overall: this.getOverallHealth(),
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      version: process.env.npm_package_version || 'unknown'
    };
  }

  /**
   * Check if system is ready to serve requests
   */
  isHealthy() {
    const overall = this.getOverallHealth();
    return overall === 'healthy' || overall === 'degraded';
  }

  /**
   * Check if database is operational
   */
  isDatabaseHealthy() {
    return this.healthStatus.database === 'healthy';
  }
}

module.exports = HealthMonitorService;
