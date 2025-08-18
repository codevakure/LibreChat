/**
 * Database Abstraction Layer Integration Example
 * 
 * This file demonstrates how to integrate the new DAL with existing LibreChat code.
 * It shows both the old MongoDB-specific approach and the new database-agnostic approach.
 */

const { initializeDAL, getRepository, repositories } = require('../dal');

/**
 * Example 1: User Management
 * Before: Direct Mongoose model usage
 * After: Repository pattern with database abstraction
 */

// OLD APPROACH (MongoDB-specific)
// const User = require('../db/models').User;
// 
// async function createUser(userData) {
//   try {
//     const user = await User.create(userData);
//     return user;
//   } catch (error) {
//     console.error('Error creating user:', error);
//     throw error;
//   }
// }

// NEW APPROACH (Database-agnostic)
async function createUser(userData) {
  try {
    const userRepo = getRepository('user');
    // or use shortcut: repositories.user()
    const user = await userRepo.create(userData);
    return user;
  } catch (error) {
    console.error('Error creating user:', error);
    throw error;
  }
}

/**
 * Example 2: Message Operations
 * Demonstrates complex queries with the new system
 */

// OLD APPROACH
// const Message = require('../db/models').Message;
// 
// async function getConversationMessages(conversationId, page = 1, limit = 50) {
//   try {
//     const skip = (page - 1) * limit;
//     const messages = await Message.find({ conversationId })
//       .sort({ createdAt: 1 })
//       .limit(limit)
//       .skip(skip)
//       .populate('user', 'username email');
//     
//     const total = await Message.countDocuments({ conversationId });
//     
//     return {
//       messages,
//       pagination: {
//         page,
//         limit,
//         total,
//         pages: Math.ceil(total / limit)
//       }
//     };
//   } catch (error) {
//     console.error('Error fetching messages:', error);
//     throw error;
//   }
// }

// NEW APPROACH
async function getConversationMessages(conversationId, page = 1, limit = 50) {
  try {
    const messageRepo = repositories.message();
    
    // Use built-in pagination from BaseRepository
    const result = await messageRepo.paginate(
      { conversationId },
      {
        page,
        limit,
        sort: { createdAt: 1 },
        populate: 'user' // This would be handled by the adapter
      }
    );
    
    return result;
  } catch (error) {
    console.error('Error fetching messages:', error);
    throw error;
  }
}

/**
 * Example 3: Complex Queries and Transactions
 * Shows how to use transactions and complex operations
 */

// NEW APPROACH with transactions
async function createConversationWithFirstMessage(userId, title, messageText) {
  const { withTransaction } = require('../dal');
  
  return await withTransaction(async (transaction) => {
    // Create conversation
    const conversationRepo = repositories.conversation();
    const conversation = await conversationRepo.create({
      user: userId,
      title,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    // Create first message
    const messageRepo = repositories.message();
    const message = await messageRepo.create({
      conversationId: conversation.id,
      user: userId,
      text: messageText,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    // Update conversation with last activity
    await conversationRepo.updateLastActivity(conversation.id);
    
    return { conversation, message };
  });
}

/**
 * Example 4: Search Operations
 * Demonstrates database-agnostic search
 */

async function searchUsersAndConversations(searchTerm, userId) {
  try {
    const userRepo = repositories.user();
    const conversationRepo = repositories.conversation();
    
    // Search users
    const users = await userRepo.search(searchTerm, {
      limit: 10,
      select: 'username email name avatar'
    });
    
    // Search user's conversations
    const conversations = await conversationRepo.searchByUser(userId, searchTerm, {
      limit: 20,
      sort: { updatedAt: -1 }
    });
    
    return { users, conversations };
  } catch (error) {
    console.error('Error searching:', error);
    throw error;
  }
}

/**
 * Example 5: Migration Helper
 * Shows how to migrate existing code gradually
 */

class UserService {
  constructor() {
    this.userRepo = null;
  }
  
  async initialize() {
    // Initialize DAL if not already done
    await initializeDAL();
    this.userRepo = repositories.user();
  }
  
  // Updated methods using DAL
  async getUserById(id) {
    return await this.userRepo.findById(id);
  }
  
  async getUserByEmail(email) {
    return await this.userRepo.findByEmail(email);
  }
  
  async createUser(userData) {
    return await this.userRepo.create(userData);
  }
  
  async updateUser(id, updates) {
    return await this.userRepo.updateById(id, updates);
  }
  
  async deleteUser(id) {
    return await this.userRepo.deleteById(id);
  }
  
  // New methods possible with DAL
  async getUserStats(userId) {
    const conversationRepo = repositories.conversation();
    const messageRepo = repositories.message();
    
    const [conversationStats, messageCount] = await Promise.all([
      conversationRepo.getUserStats(userId),
      messageRepo.count({ user: userId })
    ]);
    
    return {
      ...conversationStats,
      totalMessages: messageCount
    };
  }
}

/**
 * Example 6: Express Route Integration
 * Shows how to use DAL in API routes
 */

// Before DAL initialization in app.js or server.js:
// await initializeDAL();

async function setupUserRoutes(app) {
  // GET /api/users/:id
  app.get('/api/users/:id', async (req, res) => {
    try {
      const userRepo = repositories.user();
      const user = await userRepo.findById(req.params.id);
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      res.json(user);
    } catch (error) {
      console.error('Error fetching user:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
  
  // POST /api/users
  app.post('/api/users', async (req, res) => {
    try {
      const userRepo = repositories.user();
      
      // Check if email already exists
      const emailExists = await userRepo.emailExists(req.body.email);
      if (emailExists) {
        return res.status(400).json({ error: 'Email already exists' });
      }
      
      const user = await userRepo.create(req.body);
      res.status(201).json(user);
    } catch (error) {
      console.error('Error creating user:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
  
  // GET /api/users/:id/conversations
  app.get('/api/users/:id/conversations', async (req, res) => {
    try {
      const conversationRepo = repositories.conversation();
      const { page = 1, limit = 20 } = req.query;
      
      const result = await conversationRepo.paginate(
        { user: req.params.id },
        {
          page: parseInt(page),
          limit: parseInt(limit),
          sort: { updatedAt: -1 }
        }
      );
      
      res.json(result);
    } catch (error) {
      console.error('Error fetching conversations:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
}

/**
 * Example 7: Health Check Endpoint
 * Database health monitoring
 */

async function setupHealthRoutes(app) {
  app.get('/api/health/database', async (req, res) => {
    try {
      const { healthCheck } = require('../dal');
      const health = await healthCheck();
      
      const statusCode = health.status === 'healthy' ? 200 : 503;
      res.status(statusCode).json(health);
    } catch (error) {
      res.status(503).json({
        status: 'error',
        message: 'Health check failed',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });
}

module.exports = {
  createUser,
  getConversationMessages,
  createConversationWithFirstMessage,
  searchUsersAndConversations,
  UserService,
  setupUserRoutes,
  setupHealthRoutes
};
