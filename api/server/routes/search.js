const express = require('express');
const { MeiliSearch } = require('meilisearch');
const requireJwtAuth = require('~/server/middleware/requireJwtAuth');
const { isEnabled } = require('~/server/utils');
const { searchService } = require('~/dal/services/SearchService');
const { logger } = require('@librechat/data-schemas');

const router = express.Router();

router.use(requireJwtAuth);

// Check if search is enabled
router.get('/enable', async function (req, res) {
  if (!isEnabled(process.env.SEARCH)) {
    return res.send(false);
  }

  try {
    const client = new MeiliSearch({
      host: process.env.MEILI_HOST,
      apiKey: process.env.MEILI_MASTER_KEY,
    });

    const { status } = await client.health();
    return res.send(status === 'available');
  } catch (error) {
    return res.send(false);
  }
});

// Health check for search service
router.get('/health', async function (req, res) {
  try {
    const health = await searchService.healthCheck();
    res.json(health);
  } catch (error) {
    logger.error('Search health check failed:', error);
    res.status(500).json({
      status: 'error',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Search all content types
router.get('/', async function (req, res) {
  try {
    const { q: query, limit = 20, offset = 0, type } = req.query;
    const userId = req.user?.id;

    if (!query || query.trim().length === 0) {
      return res.json({
        conversations: [],
        messages: [],
        files: [],
        totalResults: 0
      });
    }

    const options = {
      limit: Math.min(parseInt(limit), 100), // Max 100 results
      offset: parseInt(offset),
      userId
    };

    let results;

    if (type) {
      // Search specific content type
      switch (type) {
        case 'conversations':
          results = {
            conversations: await searchService.searchConversations(query, options),
            messages: [],
            files: [],
            totalResults: 0
          };
          results.totalResults = results.conversations.length;
          break;
        case 'messages':
          results = {
            conversations: [],
            messages: await searchService.searchMessages(query, options),
            files: [],
            totalResults: 0
          };
          results.totalResults = results.messages.length;
          break;
        case 'files':
          results = {
            conversations: [],
            messages: [],
            files: await searchService.searchFiles(query, options),
            totalResults: 0
          };
          results.totalResults = results.files.length;
          break;
        default:
          results = await searchService.searchAll(query, options);
      }
    } else {
      // Search all content types
      results = await searchService.searchAll(query, options);
    }

    res.json(results);
  } catch (error) {
    logger.error('Search failed:', error);
    res.status(500).json({
      error: 'Search failed',
      message: error.message
    });
  }
});

// Search within a specific conversation
router.get('/conversations/:conversationId', async function (req, res) {
  try {
    const { conversationId } = req.params;
    const { q: query, limit = 20, offset = 0 } = req.query;
    const userId = req.user?.id;

    if (!query || query.trim().length === 0) {
      return res.json([]);
    }

    const options = {
      limit: Math.min(parseInt(limit), 100),
      offset: parseInt(offset),
      userId
    };

    const results = await searchService.searchInConversation(conversationId, query, options);
    res.json(results);
  } catch (error) {
    logger.error('Conversation search failed:', error);
    res.status(500).json({
      error: 'Conversation search failed',
      message: error.message
    });
  }
});

// Get search suggestions
router.get('/suggestions', async function (req, res) {
  try {
    const { q: query, limit = 5 } = req.query;
    const userId = req.user?.id;

    if (!query || query.trim().length < 2) {
      return res.json([]);
    }

    const suggestions = await searchService.getSearchSuggestions(userId, query, {
      limit: Math.min(parseInt(limit), 10)
    });

    res.json(suggestions);
  } catch (error) {
    logger.error('Search suggestions failed:', error);
    res.status(500).json({
      error: 'Search suggestions failed',
      message: error.message
    });
  }
});

// Advanced search with filters
router.post('/advanced', async function (req, res) {
  try {
    const { query, filters = {}, limit = 20, offset = 0 } = req.body;
    const userId = req.user?.id;

    if (!query || query.trim().length === 0) {
      return res.json({
        conversations: [],
        messages: [],
        files: [],
        totalResults: 0
      });
    }

    const options = {
      limit: Math.min(parseInt(limit), 100),
      offset: parseInt(offset),
      userId
    };

    const results = await searchService.searchWithFilters(query, filters, options);
    res.json(results);
  } catch (error) {
    logger.error('Advanced search failed:', error);
    res.status(500).json({
      error: 'Advanced search failed',
      message: error.message
    });
  }
});

// Get search statistics (admin only)
router.get('/stats', async function (req, res) {
  try {
    // Basic auth check - could be enhanced with proper admin middleware
    if (!req.user?.role || req.user.role !== 'admin') {
      return res.status(403).json({
        error: 'Unauthorized',
        message: 'Admin access required'
      });
    }

    const stats = await searchService.getSearchStats();
    res.json(stats);
  } catch (error) {
    logger.error('Get search stats failed:', error);
    res.status(500).json({
      error: 'Get search stats failed',
      message: error.message
    });
  }
});

// Sync search indices (admin only)
router.post('/sync', async function (req, res) {
  try {
    // Basic auth check - could be enhanced with proper admin middleware
    if (!req.user?.role || req.user.role !== 'admin') {
      return res.status(403).json({
        error: 'Unauthorized',
        message: 'Admin access required'
      });
    }

    const { batchSize = 100, delay = 100 } = req.body;
    
    const results = await searchService.syncSearchIndices({
      batchSize: Math.min(parseInt(batchSize), 1000),
      delay: parseInt(delay)
    });

    res.json({
      message: 'Search index sync completed',
      results
    });
  } catch (error) {
    logger.error('Search index sync failed:', error);
    res.status(500).json({
      error: 'Search index sync failed',
      message: error.message
    });
  }
});

// Clear search indices (admin only)
router.delete('/indices', async function (req, res) {
  try {
    // Basic auth check - could be enhanced with proper admin middleware
    if (!req.user?.role || req.user.role !== 'admin') {
      return res.status(403).json({
        error: 'Unauthorized',
        message: 'Admin access required'
      });
    }

    const { collections } = req.body;
    
    const results = await searchService.clearSearchIndices(collections);

    res.json({
      message: 'Search indices cleared',
      results
    });
  } catch (error) {
    logger.error('Clear search indices failed:', error);
    res.status(500).json({
      error: 'Clear search indices failed',
      message: error.message
    });
  }
});

module.exports = router;
