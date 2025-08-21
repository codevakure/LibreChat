// health.js - Health Check API Routes
const express = require('express');
const { logger } = require('@librechat/data-schemas');
const router = express.Router();

/**
 * Health Check Routes for Database and System Monitoring
 * Provides health status, metrics, and system information
 */

/**
 * GET /health - Basic health check
 * Returns simple health status for load balancers
 */
router.get('/', async (req, res) => {
  try {
    const healthMonitor = req.app.locals.healthMonitor;
    
    if (!healthMonitor) {
      return res.status(503).json({
        status: 'error',
        message: 'Health monitor not initialized'
      });
    }

    const isHealthy = healthMonitor.isHealthy();
    const summary = healthMonitor.getHealthSummary();

    const statusCode = isHealthy ? 200 : 503;
    
    res.status(statusCode).json({
      status: summary.overall,
      timestamp: new Date().toISOString(),
      checks: {
        database: summary.database,
        search: summary.search,
        system: summary.system
      }
    });

  } catch (error) {
    logger.error('Health check endpoint error:', error);
    res.status(503).json({
      status: 'error',
      message: 'Health check failed',
      error: error.message
    });
  }
});

/**
 * GET /health/detailed - Detailed health report
 * Returns comprehensive health information
 */
router.get('/detailed', async (req, res) => {
  try {
    const healthMonitor = req.app.locals.healthMonitor;
    
    if (!healthMonitor) {
      return res.status(503).json({
        status: 'error',
        message: 'Health monitor not initialized'
      });
    }

    const detailedReport = healthMonitor.getDetailedHealthReport();
    
    res.json(detailedReport);

  } catch (error) {
    logger.error('Detailed health check error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get detailed health report',
      error: error.message
    });
  }
});

/**
 * GET /health/database - Database-specific health
 * Returns database connection and performance metrics
 */
router.get('/database', async (req, res) => {
  try {
    const healthMonitor = req.app.locals.healthMonitor;
    
    if (!healthMonitor) {
      return res.status(503).json({
        status: 'error',
        message: 'Health monitor not initialized'
      });
    }

    const healthStatus = healthMonitor.getHealthStatus();
    const dbCheck = healthStatus.checks.database;

    if (!dbCheck) {
      return res.status(503).json({
        status: 'error',
        message: 'Database health check not available'
      });
    }

    const statusCode = dbCheck.status === 'healthy' ? 200 : 503;
    
    res.status(statusCode).json({
      status: dbCheck.status,
      type: dbCheck.type,
      metrics: dbCheck.metrics,
      duration: dbCheck.duration,
      message: dbCheck.message,
      timestamp: healthStatus.lastCheck
    });

  } catch (error) {
    logger.error('Database health check error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Database health check failed',
      error: error.message
    });
  }
});

/**
 * GET /health/search - Search engine health
 * Returns search service status and metrics
 */
router.get('/search', async (req, res) => {
  try {
    const healthMonitor = req.app.locals.healthMonitor;
    
    if (!healthMonitor) {
      return res.status(503).json({
        status: 'error',
        message: 'Health monitor not initialized'
      });
    }

    const healthStatus = healthMonitor.getHealthStatus();
    const searchCheck = healthStatus.checks.search;

    if (!searchCheck) {
      return res.status(503).json({
        status: 'error',
        message: 'Search health check not available'
      });
    }

    const statusCode = searchCheck.status === 'healthy' ? 200 : 
                      searchCheck.status === 'disabled' ? 200 : 503;
    
    res.status(statusCode).json({
      status: searchCheck.status,
      type: searchCheck.type,
      metrics: searchCheck.metrics,
      duration: searchCheck.duration,
      message: searchCheck.message,
      timestamp: healthStatus.lastCheck
    });

  } catch (error) {
    logger.error('Search health check error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Search health check failed',
      error: error.message
    });
  }
});

/**
 * GET /health/system - System resource health
 * Returns memory, CPU, and disk metrics
 */
router.get('/system', async (req, res) => {
  try {
    const healthMonitor = req.app.locals.healthMonitor;
    
    if (!healthMonitor) {
      return res.status(503).json({
        status: 'error',
        message: 'Health monitor not initialized'
      });
    }

    const healthStatus = healthMonitor.getHealthStatus();
    const systemCheck = healthStatus.checks;

    res.json({
      status: healthStatus.system,
      memory: systemCheck.memory,
      disk: systemCheck.disk,
      timestamp: healthStatus.lastCheck,
      environment: process.env.NODE_ENV,
      version: process.env.npm_package_version || 'unknown',
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch
    });

  } catch (error) {
    logger.error('System health check error:', error);
    res.status(500).json({
      status: 'error',
      message: 'System health check failed',
      error: error.message
    });
  }
});

/**
 * GET /health/readiness - Kubernetes readiness probe
 * Returns 200 if system is ready to serve requests
 */
router.get('/readiness', async (req, res) => {
  try {
    const healthMonitor = req.app.locals.healthMonitor;
    
    if (!healthMonitor) {
      return res.status(503).json({
        status: 'not-ready',
        message: 'Health monitor not initialized'
      });
    }

    const isReady = healthMonitor.isDatabaseHealthy();
    
    if (isReady) {
      res.json({
        status: 'ready',
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(503).json({
        status: 'not-ready',
        message: 'Database not healthy',
        timestamp: new Date().toISOString()
      });
    }

  } catch (error) {
    logger.error('Readiness check error:', error);
    res.status(503).json({
      status: 'not-ready',
      message: 'Readiness check failed',
      error: error.message
    });
  }
});

/**
 * GET /health/liveness - Kubernetes liveness probe
 * Returns 200 if application is alive
 */
router.get('/liveness', (req, res) => {
  // Simple liveness check - if we can respond, we're alive
  res.json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

/**
 * GET /health/metrics - Prometheus-style metrics
 * Returns metrics in Prometheus format
 */
router.get('/metrics', async (req, res) => {
  try {
    const healthMonitor = req.app.locals.healthMonitor;
    
    if (!healthMonitor) {
      return res.status(503).text('# Health monitor not initialized');
    }

    const healthStatus = healthMonitor.getHealthStatus();
    const dbCheck = healthStatus.checks.database;
    const memoryCheck = healthStatus.checks.memory;

    // Generate Prometheus-style metrics
    let metrics = [];
    
    // Application info
    metrics.push('# HELP librechat_info Application information');
    metrics.push('# TYPE librechat_info gauge');
    metrics.push(`librechat_info{version="${process.env.npm_package_version || 'unknown'}",environment="${process.env.NODE_ENV}"} 1`);
    
    // Database metrics
    if (dbCheck && dbCheck.metrics) {
      metrics.push('# HELP librechat_database_status Database status (1=healthy, 0=unhealthy)');
      metrics.push('# TYPE librechat_database_status gauge');
      metrics.push(`librechat_database_status{type="${dbCheck.type}"} ${dbCheck.status === 'healthy' ? 1 : 0}`);
      
      if (dbCheck.metrics.activeConnections !== undefined) {
        metrics.push('# HELP librechat_database_connections Active database connections');
        metrics.push('# TYPE librechat_database_connections gauge');
        metrics.push(`librechat_database_connections{type="${dbCheck.type}"} ${dbCheck.metrics.activeConnections}`);
      }
      
      if (dbCheck.metrics.totalQueries !== undefined) {
        metrics.push('# HELP librechat_database_queries_total Total database queries');
        metrics.push('# TYPE librechat_database_queries_total counter');
        metrics.push(`librechat_database_queries_total{type="${dbCheck.type}"} ${dbCheck.metrics.totalQueries}`);
      }
      
      if (dbCheck.metrics.averageQueryTime !== undefined) {
        metrics.push('# HELP librechat_database_query_duration_ms Average query duration in milliseconds');
        metrics.push('# TYPE librechat_database_query_duration_ms gauge');
        metrics.push(`librechat_database_query_duration_ms{type="${dbCheck.type}"} ${dbCheck.metrics.averageQueryTime}`);
      }
    }
    
    // Memory metrics
    if (memoryCheck) {
      metrics.push('# HELP librechat_memory_usage_mb Memory usage in megabytes');
      metrics.push('# TYPE librechat_memory_usage_mb gauge');
      metrics.push(`librechat_memory_usage_mb{type="rss"} ${memoryCheck.rss}`);
      metrics.push(`librechat_memory_usage_mb{type="heap_used"} ${memoryCheck.heapUsed}`);
      metrics.push(`librechat_memory_usage_mb{type="heap_total"} ${memoryCheck.heapTotal}`);
      
      metrics.push('# HELP librechat_uptime_minutes Application uptime in minutes');
      metrics.push('# TYPE librechat_uptime_minutes gauge');
      metrics.push(`librechat_uptime_minutes ${memoryCheck.uptime}`);
    }

    res.type('text/plain').send(metrics.join('\n') + '\n');

  } catch (error) {
    logger.error('Metrics endpoint error:', error);
    res.status(500).send('# Error generating metrics\n');
  }
});

module.exports = router;
