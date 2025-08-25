# Pleach Multi-Database Support Plan

## Overview

This document outlines the plan to support both MongoDB and PostgreSQL in Pleach, allowing users to choose their preferred database during initial setup. Users will select either MongoDB OR PostgreSQL at installation time - there is no migration between databases or dual-database operation.

## Current Architecture

Pleach currently uses:
- **MongoDB** as the primary database with Mongoose ODM
- **Schemas** defined in `packages/data-schemas/src/schema/`
- **Models** created dynamically via `createModels()` function
- **MeiliSearch** integration for search functionality
- **PostgreSQL** already used for RAG vector database (pgvector)

## Feasibility Assessment: Critical Challenges

### **Is Multi-Database Support Truly Feasible?**

After deep analysis of the Pleach codebase, supporting both MongoDB and PostgreSQL end-to-end presents **significant technical challenges** that need honest evaluation:

#### **🔴 Major Challenges**

1. **Deep Mongoose Integration**
   - Extensive use of Mongoose-specific features (middleware, plugins, virtuals)
   - Complex schema relationships with ObjectId references
   - Heavy reliance on MongoDB's document structure
   - Mongoose hooks and plugins (especially MeiliSearch integration)

2. **MongoDB-Specific Features**
   ```javascript
   // Examples from codebase:
   - GridFS for file storage
   - ObjectId references and relationships
   - Complex aggregation pipelines
   - Document-based data structures (JSONB in PostgreSQL isn't equivalent)
   - Mongoose plugins like mongoMeili.ts
   ```

3. **Complex Data Relationships**
   ```javascript
   // Current codebase has intricate relationships:
   - User -> Conversations -> Messages (with threading)
   - Agents -> Files -> Projects (many-to-many)
   - Plugin Auth -> Users -> Tools (complex auth flows)
   - Transactions -> Balances (financial accuracy requirements)
   ```

4. **Search Integration Complexity**
   - MeiliSearch tightly coupled with MongoDB through mongoMeili plugin
   - Document synchronization hooks embedded in Mongoose schemas
   - Search indexing tied to MongoDB's document structure

5. **Business Logic Embedded in Database Layer**
   ```javascript
   // Examples of tight coupling:
   - Transaction handling with optimistic locking
   - Complex aggregation queries for prompts/groups
   - File relationship management
   - Real-time conversation updates
   ```

#### **🟡 Moderate Challenges**

1. **Schema Differences**
   - MongoDB's flexible schemas vs PostgreSQL's strict types
   - Array fields and embedded documents
   - JSONB limitations compared to native MongoDB documents

2. **Performance Characteristics**
   - Different indexing strategies
   - Query optimization patterns
   - Connection pooling differences

3. **Testing Complexity**
   - Need to maintain test suites for both databases
   - Different edge cases and failure modes
   - Data consistency validation

#### **🟢 Manageable Aspects**

1. **Authentication System** - Relatively straightforward to abstract
2. **Basic CRUD Operations** - Can be handled by repository pattern
3. **Configuration Management** - Environment-based selection works
4. **File Storage** - Already abstracted to some degree

### **Realistic Effort Assessment**

#### **Conservative Estimate (Full Feature Parity)**
- **Single Developer**: 12-18 months (not 4-6 months)
- **Small Team (2-3)**: 8-12 months (not 3 months)
- **Medium Team (4-5)**: 6-9 months (not 2-3 months)

#### **Why Much Longer?**
1. **Re-architecture Required**: Not just abstraction, but fundamental restructuring
2. **Complex Testing**: Each feature needs validation on both databases
3. **Edge Case Handling**: Different database behaviors require different solutions
4. **Performance Optimization**: Two completely different optimization strategies
5. **Migration Tools**: Complex data transformation utilities needed

### **Revised Thinking: Why Support Both Makes Sense**

You're absolutely correct! If we're doing the substantial work to make Pleach work with PostgreSQL, we're essentially solving all the hard problems already. At that point, **keeping MongoDB support is actually logical** because:

#### **The Heavy Lifting Is the Same**
1. **Database Abstraction Layer** - Required for PostgreSQL anyway
2. **Repository Pattern** - Needed to abstract MongoDB operations  
3. **Schema Mapping** - Have to solve MongoDB → PostgreSQL translation
4. **Query Abstraction** - Required to make PostgreSQL work
5. **Search Integration** - Must be database-agnostic for PostgreSQL

#### **Incremental Effort for Dual Support**
Once we build the abstraction layer for PostgreSQL, maintaining MongoDB becomes:
- **MongoDB Adapter**: Wrapper around existing Mongoose code (~2-3 weeks)
- **Testing**: Already needed for PostgreSQL validation
- **Documentation**: Marginal additional effort

#### **Business Benefits of Both**
- **User Choice**: Let users pick based on their expertise/infrastructure
- **Migration Path**: Users can start with MongoDB, migrate to PostgreSQL later
- **Risk Mitigation**: If one database has issues, users have alternatives
- **Community**: Broader adoption from both MongoDB and PostgreSQL communities

### **Revised Recommendation: Support Both Databases**

**Why This Makes More Sense:**

1. **80% of Effort Goes to Abstraction**: Whether we support one or both databases
2. **MongoDB Adapter is Easier**: We already have working MongoDB code
3. **PostgreSQL Adapter is the Hard Part**: New schema design, query translation
4. **Maintenance Overhead is Manageable**: If abstraction is done right

#### **Revised Timeline (Supporting Both)**
- **Single Developer**: 12-15 months (only +2-3 months vs PostgreSQL-only)
- **Small Team (2-3)**: 8-10 months (only +1-2 months vs PostgreSQL-only)  
- **Medium Team (4-5)**: 6-8 months (only +1 month vs PostgreSQL-only)

The incremental effort to support both is much smaller than the base effort to create the abstraction layer.

### **Updated Implementation Strategy**

#### **Phase 1: Database Abstraction Foundation (Same Either Way)**
- Build repository pattern and adapter interfaces
- Create database-agnostic business logic layer
- Set up configuration system for database selection

#### **Phase 2: PostgreSQL Implementation (The Hard Part)**
- Design PostgreSQL schemas equivalent to MongoDB documents
- Implement complex query translations (aggregations, joins, etc.)
- Handle data type mappings and relationship structures
- Build PostgreSQL-specific optimizations

#### **Phase 3: MongoDB Adapter (The Easy Part)**
- Wrap existing Mongoose operations in adapter pattern
- Maintain current MongoDB functionality through new interface
- Preserve existing optimizations and query patterns
- Minimal changes to proven, working code

#### **Phase 4: Testing & Integration**
- Comprehensive testing on both databases
- Performance optimization for each database type
- Documentation and deployment configurations

### **Why This Approach Works Better**

1. **Leverage Existing Investment**: Don't throw away working MongoDB code
2. **Risk Mitigation**: If PostgreSQL has issues, MongoDB is still available
3. **User Flexibility**: Let users choose based on their needs
4. **Gradual Migration**: Users can switch databases when ready
5. **Community Adoption**: Appeal to both database ecosystems

### **The Real Effort Breakdown**

| Component | PostgreSQL-Only | Both Databases | Difference |
|-----------|----------------|----------------|------------|
| Abstraction Layer | 100% | 100% | 0% |
| PostgreSQL Adapter | 100% | 100% | 0% |
| MongoDB Adapter | 0% | 20% | +20% |
| Testing | 100% | 120% | +20% |
| Documentation | 100% | 110% | +10% |
| **Total Effort** | **100%** | **120%** | **+20%** |

**Key Insight**: Supporting both databases only adds ~20% more effort than PostgreSQL-only, because the hard work (abstraction + PostgreSQL) is required either way.

---

## Phase-Based Implementation Plan

### **Phase 1: Database Abstraction Layer & Configuration**
*Duration: 2-3 weeks*
*Goal: Create foundation for multi-database support*

#### **1.1 Database Abstraction Layer (DAL)**

Create a new database abstraction layer structure:

```
api/
├── dal/
│   ├── index.js                    # Export all DAL components
│   ├── DatabaseManager.js          # Main database manager
│   ├── adapters/
│   │   ├── BaseAdapter.js          # Abstract base adapter
│   │   ├── MongoAdapter.js         # MongoDB implementation
│   │   └── PostgresAdapter.js     # PostgreSQL implementation
│   ├── repositories/
│   │   ├── BaseRepository.js       # Base repository pattern
│   │   ├── UserRepository.js       # User-specific operations
│   │   ├── MessageRepository.js    # Message operations
│   │   ├── ConversationRepository.js
│   │   ├── AgentRepository.js
│   │   ├── FileRepository.js
│   │   ├── PresetRepository.js
│   │   ├── SessionRepository.js
│   │   ├── BalanceRepository.js
│   │   ├── PluginAuthRepository.js
│   │   └── [All other entities]
│   ├── schemas/
│   │   ├── universal/              # Database-agnostic schemas
│   │   ├── mongodb/               # MongoDB-specific schemas
│   │   └── postgresql/           # PostgreSQL-specific schemas
│   └── migrations/
│       ├── mongodb/                # MongoDB initial setup
│       └── postgresql/             # PostgreSQL initial setup
```

#### **1.2 Configuration Enhancement**

Update environment configuration to support database selection:

```bash
# Database Configuration
DATABASE_TYPE=mongodb              # Options: 'mongodb' or 'postgresql'

# MongoDB Configuration (existing)
MONGO_URI=mongodb://127.0.0.1:27017/Pleach

# PostgreSQL Configuration (new)
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DATABASE=pleach
POSTGRES_USERNAME=pleach_user
POSTGRES_PASSWORD=your_password
POSTGRES_SSL=false
POSTGRES_MAX_CONNECTIONS=20
POSTGRES_CONNECTION_TIMEOUT=30000
```

#### **1.3 Database Manager Implementation**

```javascript
// api/dal/DatabaseManager.js
class DatabaseManager {
  constructor() {
    this.adapter = null;
    this.repositories = {};
  }

  async initialize() {
    const dbType = process.env.DATABASE_TYPE || 'mongodb';
    
    if (dbType === 'mongodb') {
      this.adapter = new MongoAdapter();
    } else if (dbType === 'postgresql') {
      this.adapter = new PostgresAdapter();
    } else {
      throw new Error(`Unsupported database type: ${dbType}`);
    }

    await this.adapter.connect();
    this.initializeRepositories();
  }

  initializeRepositories() {
    this.repositories.user = new UserRepository(this.adapter);
    this.repositories.message = new MessageRepository(this.adapter);
    this.repositories.conversation = new ConversationRepository(this.adapter);
    // ... initialize all repositories
  }

  getRepository(name) {
    return this.repositories[name];
  }
}
```

#### **1.4 Repository Pattern Implementation**

```javascript
// api/dal/repositories/BaseRepository.js
class BaseRepository {
  constructor(adapter) {
    this.adapter = adapter;
  }

  async findById(id) {
    return this.adapter.findById(this.tableName, id);
  }

  async create(data) {
    return this.adapter.create(this.tableName, data);
  }

  async update(id, data) {
    return this.adapter.update(this.tableName, id, data);
  }

  async delete(id) {
    return this.adapter.delete(this.tableName, id);
  }

  async findMany(query, options = {}) {
    return this.adapter.findMany(this.tableName, query, options);
  }
}
```

**Deliverables:**
- Database adapter pattern implemented
- Configuration system for database selection
- Base repository classes
- Connection management for both databases

**Testing:**
- Unit tests for adapters
- Configuration validation tests
- Repository pattern tests
- Connection pooling tests

---

### **Phase 2: Core Entity Implementation**
*Duration: 3-4 weeks*
*Goal: Implement User, Session, and Authentication for both databases*

#### **2.1 User Management System**

**MongoDB Implementation:**
```javascript
// api/dal/adapters/MongoAdapter.js
class MongoAdapter extends BaseAdapter {
  async findById(collection, id) {
    const Model = this.getModel(collection);
    return await Model.findById(id);
  }

  async create(collection, data) {
    const Model = this.getModel(collection);
    return await Model.create(data);
  }
}
```

**PostgreSQL Implementation:**
```javascript
// api/dal/adapters/PostgresAdapter.js
class PostgresAdapter extends BaseAdapter {
  async findById(table, id) {
    const query = `SELECT * FROM ${table} WHERE id = $1`;
    const result = await this.pool.query(query, [id]);
    return result.rows[0];
  }

  async create(table, data) {
    const fields = Object.keys(data).join(', ');
    const values = Object.values(data);
    const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
    
    const query = `INSERT INTO ${table} (${fields}) VALUES (${placeholders}) RETURNING *`;
    const result = await this.pool.query(query, values);
    return result.rows[0];
  }
}
```

#### **2.2 PostgreSQL Schema Definitions**

```sql
-- migrations/postgresql/001_initial_schema.sql

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(255) UNIQUE,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255),
    name VARCHAR(255),
    avatar VARCHAR(255),
    role VARCHAR(50) DEFAULT 'USER',
    provider VARCHAR(50) DEFAULT 'local',
    provider_id VARCHAR(255),
    email_verified BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Sessions table
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    session_id VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Balances table
CREATE TABLE balances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user VARCHAR(255) UNIQUE NOT NULL,
    token_credits DECIMAL(15, 6) DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_session_id ON sessions(session_id);
CREATE INDEX idx_balances_user ON balances(user);
```

#### **2.3 Authentication System Updates**

Update authentication middleware to work with both databases:

```javascript
// api/middleware/authenticate.js
const { DatabaseManager } = require('~/dal');

async function authenticate(req, res, next) {
  const dbManager = DatabaseManager.getInstance();
  const userRepo = dbManager.getRepository('user');
  
  // Authentication logic remains the same
  const user = await userRepo.findById(userId);
  // ... rest of authentication logic
}
```

**Deliverables:**
- User CRUD operations for both databases
- Session management compatibility
- Authentication system supporting both databases
- PostgreSQL schema creation scripts

**Testing:**
- User registration and login testing
- Session management verification
- Password reset functionality
- Email verification flows

---

### **Phase 3: Messaging System Implementation**
*Duration: 4-5 weeks*
*Goal: Support conversations and messages in both databases*

#### **3.1 Message Storage Schema**

**PostgreSQL Message Schema:**
```sql
-- Conversations table
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id VARCHAR(255) UNIQUE NOT NULL,
    title VARCHAR(500),
    user VARCHAR(255) NOT NULL,
    endpoint VARCHAR(100),
    suggestions JSONB,
    messages TEXT[],
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Messages table
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id VARCHAR(255) UNIQUE NOT NULL,
    conversation_id VARCHAR(255) REFERENCES conversations(conversation_id),
    parent_message_id VARCHAR(255),
    user VARCHAR(255) NOT NULL,
    text TEXT,
    content JSONB,
    sender VARCHAR(100),
    is_created_by_user BOOLEAN DEFAULT false,
    is_edited BOOLEAN DEFAULT false,
    error BOOLEAN DEFAULT false,
    unfinished BOOLEAN DEFAULT false,
    cancelled BOOLEAN DEFAULT false,
    finish_reason VARCHAR(50),
    token_count INTEGER,
    plugin JSONB,
    plugins JSONB,
    model VARCHAR(100),
    endpoint VARCHAR(100),
    files JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Conversation tags
CREATE TABLE conversation_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tag VARCHAR(255) NOT NULL,
    user VARCHAR(255) NOT NULL,
    count INTEGER DEFAULT 1,
    position INTEGER DEFAULT 0,
    color VARCHAR(7),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(tag, user)
);

-- Message-Tag relationships
CREATE TABLE conversation_tag_relations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id VARCHAR(255) REFERENCES conversations(conversation_id),
    tag_id UUID REFERENCES conversation_tags(id),
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(conversation_id, tag_id)
);

-- Indexes
CREATE INDEX idx_conversations_user ON conversations(user);
CREATE INDEX idx_conversations_conversation_id ON conversations(conversation_id);
CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_message_id ON messages(message_id);
CREATE INDEX idx_messages_user ON messages(user);
CREATE INDEX idx_conversation_tags_user ON conversation_tags(user);
```

#### **3.2 Search Integration Abstraction**

Create database-agnostic search indexing:

```javascript
// api/dal/plugins/SearchIndexer.js
class SearchIndexer {
  constructor(adapter) {
    this.adapter = adapter;
    this.meiliClient = // MeiliSearch client
  }

  async indexDocument(collection, document) {
    // Common indexing logic regardless of database
    const indexableData = this.prepareForIndexing(document);
    await this.meiliClient.index(collection).addDocuments([indexableData]);
    
    // Update database-specific indexing flag
    await this.adapter.markAsIndexed(collection, document.id);
  }

  prepareForIndexing(document) {
    // Common document preparation logic
    return {
      id: document.id,
      title: document.title,
      content: document.text || document.content,
      user: document.user,
      createdAt: document.created_at || document.createdAt
    };
  }
}
```

#### **3.3 File Management System**

**PostgreSQL File Schema:**
```sql
-- Files table
CREATE TABLE files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_id VARCHAR(255) UNIQUE NOT NULL,
    user VARCHAR(255) NOT NULL,
    filename VARCHAR(500),
    filepath VARCHAR(1000),
    bytes INTEGER,
    width INTEGER,
    height INTEGER,
    type VARCHAR(100),
    object VARCHAR(50) DEFAULT 'file',
    source VARCHAR(100),
    temp_file_id VARCHAR(255),
    embedded BOOLEAN DEFAULT false,
    hash_name VARCHAR(500),
    usage_count INTEGER DEFAULT 0,
    context VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- File-Agent relationships
CREATE TABLE file_agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_id VARCHAR(255) REFERENCES files(file_id),
    agent_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(file_id, agent_id)
);

-- Indexes
CREATE INDEX idx_files_user ON files(user);
CREATE INDEX idx_files_file_id ON files(file_id);
CREATE INDEX idx_file_agents_file_id ON file_agents(file_id);
CREATE INDEX idx_file_agents_agent_id ON file_agents(agent_id);
```

**Deliverables:**
- Message CRUD operations for both databases
- Conversation management system
- File attachment handling
- Search indexing compatibility

**Testing:**
- Message creation and retrieval
- Conversation threading
- File upload and association
- Search functionality validation

---

### **Phase 4: Advanced Features Implementation**
*Duration: 4-5 weeks*
*Goal: Implement AI agents, assistants, and plugin systems*

#### **4.1 AI Agents & Assistants Schema**

**PostgreSQL Agents Schema:**
```sql
-- Agents table
CREATE TABLE agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    instructions TEXT,
    provider VARCHAR(100),
    model VARCHAR(100),
    author VARCHAR(255),
    version INTEGER DEFAULT 1,
    tools JSONB,
    tool_resources JSONB,
    actions JSONB,
    capabilities JSONB,
    code_interpreter BOOLEAN DEFAULT false,
    avatar JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Assistants table
CREATE TABLE assistants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assistant_id VARCHAR(255) UNIQUE NOT NULL,
    object VARCHAR(50) DEFAULT 'assistant',
    name VARCHAR(255),
    description TEXT,
    instructions TEXT,
    model VARCHAR(100),
    tools JSONB,
    tool_resources JSONB,
    metadata JSONB,
    temperature DECIMAL(3,2),
    top_p DECIMAL(3,2),
    response_format JSONB,
    user VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Projects table
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    prompt_group_ids UUID[],
    agent_ids TEXT[],
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Actions table
CREATE TABLE actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action_id VARCHAR(255) UNIQUE NOT NULL,
    metadata JSONB NOT NULL,
    user VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_agents_agent_id ON agents(agent_id);
CREATE INDEX idx_agents_author ON agents(author);
CREATE INDEX idx_assistants_assistant_id ON assistants(assistant_id);
CREATE INDEX idx_assistants_user ON assistants(user);
CREATE INDEX idx_actions_action_id ON actions(action_id);
CREATE INDEX idx_actions_user ON actions(user);
```

#### **4.2 Plugin System Schema**

```sql
-- Plugin authentication table
CREATE TABLE plugin_auth (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL,
    auth_field VARCHAR(255) NOT NULL,
    value TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, auth_field)
);

-- Keys table (for API keys management)
CREATE TABLE keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    value TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user, name)
);

-- Indexes
CREATE INDEX idx_plugin_auth_user_id ON plugin_auth(user_id);
CREATE INDEX idx_keys_user ON keys(user);
```

#### **4.3 Additional System Tables**

```sql
-- Presets table
CREATE TABLE presets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    preset_id VARCHAR(255) UNIQUE NOT NULL,
    title VARCHAR(255) DEFAULT 'New Chat',
    user_id VARCHAR(255),
    default_preset BOOLEAN DEFAULT false,
    "order" INTEGER,
    endpoint VARCHAR(100),
    model VARCHAR(100),
    agent_options JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Prompts table
CREATE TABLE prompts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prompt_id VARCHAR(255) UNIQUE NOT NULL,
    title VARCHAR(255) NOT NULL,
    prompt TEXT NOT NULL,
    category VARCHAR(255),
    author VARCHAR(255),
    version INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Prompt groups table
CREATE TABLE prompt_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    author VARCHAR(255),
    production_id UUID,
    category VARCHAR(255),
    version INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Shared links table
CREATE TABLE shared_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    share_id VARCHAR(255) UNIQUE NOT NULL,
    conversation_id VARCHAR(255) REFERENCES conversations(conversation_id),
    title VARCHAR(500),
    is_public BOOLEAN DEFAULT false,
    user VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Tokens table (for authentication tokens)
CREATE TABLE tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user VARCHAR(255) NOT NULL,
    token VARCHAR(1000) NOT NULL,
    type VARCHAR(50) NOT NULL,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Transactions table
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user VARCHAR(255) NOT NULL,
    amount DECIMAL(15, 6) NOT NULL,
    type VARCHAR(50) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Memory entries table
CREATE TABLE memory_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Banners table
CREATE TABLE banners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255),
    text TEXT,
    bg_color VARCHAR(7),
    type VARCHAR(50),
    is_active BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Tool calls table
CREATE TABLE tool_calls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tool_call_id VARCHAR(255) NOT NULL,
    run_id VARCHAR(255),
    type VARCHAR(50) DEFAULT 'function',
    function_name VARCHAR(255),
    function_arguments JSONB,
    output TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create remaining indexes
CREATE INDEX idx_presets_user_id ON presets(user_id);
CREATE INDEX idx_prompts_author ON prompts(author);
CREATE INDEX idx_shared_links_user ON shared_links(user);
CREATE INDEX idx_tokens_user ON tokens(user);
CREATE INDEX idx_transactions_user ON transactions(user);
CREATE INDEX idx_memory_entries_user ON memory_entries(user);
```

**Deliverables:**
- Agent/Assistant system for both databases
- Plugin authentication system
- Project management functionality
- Preset and prompt management

**Testing:**
- Agent creation and management
- Assistant API functionality
- Plugin authentication flows
- Project operations testing

---

### **Phase 5: Performance & Production Readiness**
*Duration: 2-3 weeks*
*Goal: Optimize for production and ensure scalability*

#### **5.1 Database Initialization Scripts**

**MongoDB Initialization:**
```javascript
// api/dal/migrations/mongodb/init.js
const { connectDb } = require('~/db/connect');
const { createModels } = require('@pleach/data-schemas');

async function initializeMongoDB() {
  await connectDb();
  const mongoose = require('mongoose');
  createModels(mongoose);
  
  // Create indexes
  await createMongoIndexes();
  
  console.log('MongoDB initialized successfully');
}
```

**PostgreSQL Initialization:**
```javascript
// api/dal/migrations/postgresql/init.js
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function initializePostgreSQL() {
  const pool = new Pool({
    host: process.env.POSTGRES_HOST,
    port: process.env.POSTGRES_PORT,
    database: process.env.POSTGRES_DATABASE,
    user: process.env.POSTGRES_USERNAME,
    password: process.env.POSTGRES_PASSWORD,
  });

  // Execute schema creation scripts
  const schemaFiles = [
    '001_initial_schema.sql',
    '002_agents_schema.sql',
    '003_plugins_schema.sql',
    '004_indexes.sql'
  ];

  for (const file of schemaFiles) {
    const filePath = path.join(__dirname, file);
    const sql = fs.readFileSync(filePath, 'utf8');
    await pool.query(sql);
  }

  console.log('PostgreSQL initialized successfully');
  await pool.end();
}
```

#### **5.2 Performance Optimization**

**Connection Pooling Configuration:**
```javascript
// api/dal/adapters/PostgresAdapter.js
const { Pool } = require('pg');

class PostgresAdapter extends BaseAdapter {
  constructor() {
    super();
    this.pool = new Pool({
      host: process.env.POSTGRES_HOST,
      port: process.env.POSTGRES_PORT,
      database: process.env.POSTGRES_DATABASE,
      user: process.env.POSTGRES_USERNAME,
      password: process.env.POSTGRES_PASSWORD,
      max: parseInt(process.env.POSTGRES_MAX_CONNECTIONS) || 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: parseInt(process.env.POSTGRES_CONNECTION_TIMEOUT) || 30000,
    });
  }
}
```

#### **5.3 Docker Configuration Updates**

**Updated docker-compose.yml:**
```yaml
services:
  api:
    container_name: Pleach
    ports:
      - "${PORT}:${PORT}"
    depends_on:
      - database
      - rag_api
    image: ghcr.io/danny-avila/pleach-dev:latest
    environment:
      - HOST=0.0.0.0
      - DATABASE_TYPE=${DATABASE_TYPE:-mongodb}
      - MONGO_URI=mongodb://mongodb:27017/Pleach
      - POSTGRES_HOST=postgresql
      - POSTGRES_DATABASE=pleach
      - POSTGRES_USERNAME=pleach_user
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
      - MEILI_HOST=http://meilisearch:7700
      - RAG_PORT=${RAG_PORT:-8000}
      - RAG_API_URL=http://rag_api:${RAG_PORT:-8000}
    volumes:
      - ./.env:/app/.env
      - ./images:/app/client/public/images
      - ./uploads:/app/uploads
      - ./logs:/app/api/logs

  # MongoDB service (conditional)
  mongodb:
    container_name: chat-mongodb
    image: mongo
    restart: always
    profiles:
      - mongodb
    volumes:
      - mongodb_data:/data/db
    command: mongod --noauth

  # PostgreSQL service (conditional)
  postgresql:
    container_name: chat-postgresql
    image: postgres:15
    restart: always
    profiles:
      - postgresql
    environment:
      POSTGRES_DB: pleach
      POSTGRES_USER: pleach_user
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgresql_data:/var/lib/postgresql/data
      - ./api/dal/migrations/postgresql:/docker-entrypoint-initdb.d
    ports:
      - "5432:5432"

volumes:
  mongodb_data:
  postgresql_data:
```

**Database-specific compose files:**

**docker-compose.mongodb.yml:**
```yaml
services:
  api:
    environment:
      - DATABASE_TYPE=mongodb
      - MONGO_URI=mongodb://mongodb:27017/Pleach
    depends_on:
      - mongodb

  mongodb:
    profiles: []  # Always include
```

**docker-compose.postgresql.yml:**
```yaml
services:
  api:
    environment:
      - DATABASE_TYPE=postgresql
      - POSTGRES_HOST=postgresql
    depends_on:
      - postgresql

  postgresql:
    profiles: []  # Always include
```

**Deliverables:**
- Production-ready database configurations
- Performance-optimized connection pooling
- Docker configurations for both databases
- Initialization and setup scripts

**Testing:**
- Load testing with both databases
- Connection pooling validation
- Docker deployment testing
- Performance benchmarking

---

### **Phase 6: Integration & Documentation**
*Duration: 2-3 weeks*
*Goal: Complete integration and comprehensive documentation*

#### **6.1 Application Integration**

**Main Application Bootstrap:**
```javascript
// api/server/index.js
const { DatabaseManager } = require('~/dal');

async function startServer() {
  // Initialize database based on configuration
  const dbManager = new DatabaseManager();
  await dbManager.initialize();
  
  // Make database manager available globally
  global.dbManager = dbManager;
  
  // Continue with existing server startup
  // ...
}
```

**Update Existing Models:**
```javascript
// api/models/index.js
const { DatabaseManager } = require('~/dal');

// Replace direct model access with repository pattern
const dbManager = global.dbManager || DatabaseManager.getInstance();

module.exports = {
  // Legacy compatibility
  User: dbManager.getRepository('user'),
  Message: dbManager.getRepository('message'),
  Conversation: dbManager.getRepository('conversation'),
  // ... other repositories
  
  // Existing methods updated to use repositories
  async getUser(id) {
    return await dbManager.getRepository('user').findById(id);
  },
  
  async saveMessage(data) {
    return await dbManager.getRepository('message').create(data);
  },
  // ... other methods
};
```

#### **6.2 Documentation Structure**

Create comprehensive documentation:

```
docs/
├── database-migration/
│   ├── MULTI_DATABASE_SUPPORT_PLAN.md     # This document
│   ├── INSTALLATION_GUIDE.md              # Setup instructions
│   ├── POSTGRESQL_SETUP.md                # PostgreSQL specific setup
│   ├── MONGODB_SETUP.md                   # MongoDB specific setup
│   ├── MIGRATION_GUIDE.md                 # Data migration tools
│   ├── TROUBLESHOOTING.md                 # Common issues and solutions
│   ├── PERFORMANCE_TUNING.md              # Optimization guides
│   └── API_REFERENCE.md                   # DAL API documentation
└── deployment/
    ├── docker-mongodb.md                  # MongoDB Docker deployment
    ├── docker-postgresql.md               # PostgreSQL Docker deployment
    ├── kubernetes-mongodb.yaml            # K8s manifests for MongoDB
    └── kubernetes-postgresql.yaml         # K8s manifests for PostgreSQL
```

#### **6.3 Installation Guide**

**Quick Start Guide:**
```markdown
# Database Selection Guide

## Choose Your Database

Pleach supports two database options:

### Option 1: MongoDB (Default)
```bash
# Set environment variable
DATABASE_TYPE=mongodb
MONGO_URI=mongodb://localhost:27017/Pleach

# Start with Docker
docker-compose -f docker-compose.yml -f docker-compose.mongodb.yml up -d
```

### Option 2: PostgreSQL
```bash
# Set environment variables
DATABASE_TYPE=postgresql
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DATABASE=pleach
POSTGRES_USERNAME=pleach_user
POSTGRES_PASSWORD=your_secure_password

# Start with Docker
docker-compose -f docker-compose.yml -f docker-compose.postgresql.yml up -d
```

## First Time Setup

The application will automatically:
1. Create database schemas
2. Set up required indexes
3. Initialize default data
4. Configure search indexing
```

**Deliverables:**
- Complete application integration
- Comprehensive documentation
- Installation and setup guides
- Performance tuning documentation

**Testing:**
- End-to-end functionality testing
- Documentation validation
- Installation process verification
- User acceptance testing

---

## Technical Implementation Details

### **Repository Pattern Example**

```javascript
// api/dal/repositories/UserRepository.js
class UserRepository extends BaseRepository {
  constructor(adapter) {
    super(adapter);
    this.tableName = 'users';
  }

  async findByEmail(email) {
    return this.adapter.findOne(this.tableName, { email });
  }

  async findByUsername(username) {
    return this.adapter.findOne(this.tableName, { username });
  }

  async updateLastLogin(userId) {
    return this.adapter.update(this.tableName, userId, {
      last_login: new Date()
    });
  }

  async getUserWithBalance(userId) {
    return this.adapter.findWithJoin(
      this.tableName,
      'balances',
      'user',
      userId
    );
  }
}
```

### **Database Adapter Interface**

```javascript
// api/dal/adapters/BaseAdapter.js
class BaseAdapter {
  async connect() {
    throw new Error('connect method must be implemented');
  }

  async disconnect() {
    throw new Error('disconnect method must be implemented');
  }

  async findById(table, id) {
    throw new Error('findById method must be implemented');
  }

  async findOne(table, query) {
    throw new Error('findOne method must be implemented');
  }

  async findMany(table, query, options = {}) {
    throw new Error('findMany method must be implemented');
  }

  async create(table, data) {
    throw new Error('create method must be implemented');
  }

  async update(table, id, data) {
    throw new Error('update method must be implemented');
  }

  async delete(table, id) {
    throw new Error('delete method must be implemented');
  }

  async beginTransaction() {
    throw new Error('beginTransaction method must be implemented');
  }

  async commitTransaction() {
    throw new Error('commitTransaction method must be implemented');
  }

  async rollbackTransaction() {
    throw new Error('rollbackTransaction method must be implemented');
  }
}
```

### **Search Integration**

Both databases will use the same MeiliSearch integration with database-agnostic indexing:

```javascript
// api/dal/plugins/DatabaseAgnosticSearch.js
class DatabaseAgnosticSearch {
  constructor(adapter, meiliClient) {
    this.adapter = adapter;
    this.meiliClient = meiliClient;
  }

  async indexDocument(collection, document) {
    const indexableData = this.prepareForIndexing(document);
    await this.meiliClient.index(collection).addDocuments([indexableData]);
    
    // Mark as indexed in the respective database
    await this.adapter.markAsIndexed(collection, document.id);
  }

  async syncCollection(collection) {
    const unindexedDocs = await this.adapter.findUnindexed(collection);
    
    for (const doc of unindexedDocs) {
      await this.indexDocument(collection, doc);
    }
  }
}
```

## Testing Strategy

### **Phase-by-Phase Testing**

1. **Unit Tests**: Test individual adapters and repositories
2. **Integration Tests**: Test database operations end-to-end
3. **Performance Tests**: Compare performance between databases
4. **Compatibility Tests**: Ensure feature parity
5. **Load Tests**: Validate production readiness

### **Test Coverage Areas**

- Database connection and pooling
- CRUD operations for all entities
- Search functionality
- File operations
- Authentication flows
- Session management
- Transaction handling
- Error scenarios

## Benefits of This Approach

### **For Users**
- **Choice**: Select the database that best fits their needs
- **No Migration**: Clean installation without data migration complexity
- **Familiar Tools**: Use existing database expertise and tooling
- **Scalability**: Choose based on scaling requirements

### **For Developers**
- **Clean Architecture**: Well-separated concerns with clear abstractions
- **Maintainability**: Database-specific code isolated in adapters
- **Testability**: Easy to test with different database backends
- **Extensibility**: Easy to add support for additional databases

### **For Operations**
- **Flexibility**: Deploy with preferred database infrastructure
- **Monitoring**: Use existing database monitoring tools
- **Backup/Recovery**: Use database-native backup solutions
- **Performance**: Optimize for specific database strengths

## Risk Mitigation

### **Technical Risks**
- **Performance Differences**: Mitigated by phase-wise testing and optimization
- **Feature Parity**: Addressed through comprehensive testing and validation
- **Complexity**: Managed through clean abstraction layers

### **Operational Risks**
- **Support Overhead**: Reduced through comprehensive documentation
- **Migration Complexity**: Eliminated by design choice
- **Deployment Issues**: Addressed through Docker configurations and testing

## Timeline Summary

### Single Developer Timeline

| Phase | Duration | Key Deliverables |
|-------|----------|------------------|
| Phase 1 | 2-3 weeks | Database Abstraction Layer, Configuration |
| Phase 2 | 3-4 weeks | User Management, Authentication |
| Phase 3 | 4-5 weeks | Messaging System, Search Integration |
| Phase 4 | 4-5 weeks | Agents, Assistants, Plugins |
| Phase 5 | 2-3 weeks | Performance, Production Readiness |
| Phase 6 | 2-3 weeks | Integration, Documentation |

**Total Estimated Duration (1 Developer): 17-23 weeks (4-6 months)**

### Team-Based Timeline Estimates

#### Small Team (2-3 Developers)
- **Duration**: 10-14 weeks (2.5-3.5 months)
- **Parallel Work**: Database adapters, repositories, and schemas can be developed in parallel
- **Phase 1-2**: 2-3 weeks (foundation + core entities)
- **Phase 3-4**: 4-6 weeks (messaging + advanced features in parallel)
- **Phase 5-6**: 2-3 weeks (optimization + integration)

#### Medium Team (4-5 Developers)
- **Duration**: 8-12 weeks (2-3 months)
- **Parallel Work**: Multiple phases can run concurrently
- **Specialization**: Dedicated developers for MongoDB adapter, PostgreSQL adapter, testing, and documentation
- **Phase 1**: 1-2 weeks (foundation)
- **Phase 2-4**: 4-6 weeks (parallel development)
- **Phase 5-6**: 2-3 weeks (integration + polish)

#### Large Team (6+ Developers)
- **Duration**: 6-10 weeks (1.5-2.5 months)
- **Parallel Work**: All phases can have dedicated teams
- **Specialization**: Backend, database, testing, documentation, DevOps teams
- **Rapid iteration**: Continuous integration and testing

## Conclusion

After reconsidering the approach, **supporting both MongoDB and PostgreSQL makes strategic sense** because:

### **Why Both Databases is the Right Choice:**

1. **The Hard Work is Required Anyway**: Creating the abstraction layer for PostgreSQL is 80% of the total effort
2. **MongoDB Adapter is Low-Cost**: Wrapping existing Mongoose code is relatively simple
3. **User Choice is Valuable**: Let users pick based on their expertise and infrastructure
4. **Risk Mitigation**: Multiple database options provide flexibility and reduce vendor lock-in
5. **Migration Path**: Users can start with familiar MongoDB and migrate to PostgreSQL when ready

### **Realistic Timeline (Both Databases):**
- **Single Developer**: 12-15 months 
- **Small Team (2-3)**: 8-10 months
- **Medium Team (4-5)**: 6-8 months

**Only 20% more effort than PostgreSQL-only**, because:
- Database abstraction layer: Required either way
- PostgreSQL implementation: Required either way  
- MongoDB adapter: Minimal incremental effort
- Testing: Slightly more comprehensive

### **Implementation Strategy:**

#### **Phase 1**: Build database abstraction foundation
#### **Phase 2**: Implement PostgreSQL support (the hard part)
#### **Phase 3**: Wrap MongoDB in adapter pattern (the easy part)
#### **Phase 4**: Testing, optimization, and documentation

### **Key Benefits:**

- **No Wasted MongoDB Investment**: Keep working, proven code
- **PostgreSQL Advantages**: Gain SQL capabilities and better transactions  
- **User Flexibility**: Database choice based on needs, not forced migration
- **Future-Proof**: Easy to add more databases later if needed
- **Community Growth**: Appeal to both MongoDB and PostgreSQL users

### **Final Recommendation:**

**Proceed with dual-database support** because the incremental effort is minimal compared to the substantial benefits of user choice and reduced migration risk. The abstraction work required for PostgreSQL support makes MongoDB support almost "free" to maintain.

This approach turns database selection from a forced migration into an architectural advantage that serves diverse user needs while preserving existing investments.
