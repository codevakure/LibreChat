-- LibreChat PostgreSQL Initial Schema
-- Complete database schema to replicate MongoDB functionality
-- Version: 1.0.0
-- Created: August 18, 2025
-- Purpose: Create all tables needed to support LibreChat with PostgreSQL

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(24) PRIMARY KEY DEFAULT encode(gen_random_bytes(12), 'hex'),
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(100) UNIQUE,
    name VARCHAR(255),
    password VARCHAR(255),
    avatar TEXT,
    role VARCHAR(50) DEFAULT 'user',
    provider VARCHAR(50) DEFAULT 'local',
    provider_id VARCHAR(255),
    refresh_token TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login TIMESTAMP WITH TIME ZONE
);

-- Create indexes for users table
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_provider ON users(provider, provider_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Create conversations table
CREATE TABLE IF NOT EXISTS conversations (
    id VARCHAR(24) PRIMARY KEY DEFAULT encode(gen_random_bytes(12), 'hex'),
    user_id VARCHAR(24) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT,
    endpoint VARCHAR(100) NOT NULL,
    model VARCHAR(100),
    conversation_id VARCHAR(24), -- For external conversation tracking
    agent_options JSONB,
    greeting_message JSONB,
    prompt_prefix TEXT,
    temperature DECIMAL(3,2),
    top_p DECIMAL(3,2),
    top_k INTEGER,
    context_strategy VARCHAR(50),
    resend_files BOOLEAN DEFAULT false,
    image_detail VARCHAR(20),
    icon_url TEXT,
    pinned BOOLEAN DEFAULT false,
    pinned_at TIMESTAMP WITH TIME ZONE,
    archived BOOLEAN DEFAULT false,
    archived_at TIMESTAMP WITH TIME ZONE,
    tags TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for conversations table
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_endpoint ON conversations(endpoint);
CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON conversations(updated_at);
CREATE INDEX IF NOT EXISTS idx_conversations_pinned ON conversations(pinned) WHERE pinned = true;
CREATE INDEX IF NOT EXISTS idx_conversations_archived ON conversations(archived) WHERE archived = true;
CREATE INDEX IF NOT EXISTS idx_conversations_tags ON conversations USING GIN(tags);

-- Create messages table
CREATE TABLE IF NOT EXISTS messages (
    id VARCHAR(24) PRIMARY KEY DEFAULT encode(gen_random_bytes(12), 'hex'),
    conversation_id VARCHAR(24) NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    user_id VARCHAR(24) REFERENCES users(id) ON DELETE SET NULL,
    parent_message_id VARCHAR(24),
    message_id VARCHAR(24), -- For external message tracking
    text TEXT,
    content JSONB,
    role VARCHAR(20) NOT NULL, -- 'user', 'assistant', 'system', 'tool'
    model VARCHAR(100),
    endpoint VARCHAR(100),
    token_count INTEGER,
    completion_tokens INTEGER,
    prompt_tokens INTEGER,
    plugin JSONB,
    plugins JSONB,
    tools JSONB,
    error BOOLEAN DEFAULT false,
    unfinished BOOLEAN DEFAULT false,
    cancelled BOOLEAN DEFAULT false,
    is_edited BOOLEAN DEFAULT false,
    edited_at TIMESTAMP WITH TIME ZONE,
    finish_reason VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for messages table
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_user_id ON messages(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_parent_id ON messages(parent_message_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_messages_role ON messages(role);
CREATE INDEX IF NOT EXISTS idx_messages_text_search ON messages USING GIN(to_tsvector('english', text));

-- Create files table
CREATE TABLE IF NOT EXISTS files (
    id VARCHAR(24) PRIMARY KEY DEFAULT encode(gen_random_bytes(12), 'hex'),
    user_id VARCHAR(24) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    conversation_id VARCHAR(24) REFERENCES conversations(id) ON DELETE SET NULL,
    message_id VARCHAR(24) REFERENCES messages(id) ON DELETE SET NULL,
    file_id VARCHAR(24) UNIQUE, -- For external file tracking
    object_id VARCHAR(100),
    filename VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255),
    filepath TEXT,
    mime_type VARCHAR(100),
    size_bytes BIGINT,
    width INTEGER,
    height INTEGER,
    usage VARCHAR(50), -- 'avatar', 'message_attachment', 'assistant_file', etc.
    source VARCHAR(50), -- 'local', 'openai', 'firebase', 's3', etc.
    temp_file_id VARCHAR(100),
    progress DECIMAL(5,2) DEFAULT 0,
    embedded BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for files table
CREATE INDEX IF NOT EXISTS idx_files_user_id ON files(user_id);
CREATE INDEX IF NOT EXISTS idx_files_conversation_id ON files(conversation_id);
CREATE INDEX IF NOT EXISTS idx_files_message_id ON files(message_id);
CREATE INDEX IF NOT EXISTS idx_files_file_id ON files(file_id);
CREATE INDEX IF NOT EXISTS idx_files_usage ON files(usage);
CREATE INDEX IF NOT EXISTS idx_files_source ON files(source);

-- Create sessions table (for session management)
CREATE TABLE IF NOT EXISTS sessions (
    id VARCHAR(24) PRIMARY KEY DEFAULT encode(gen_random_bytes(12), 'hex'),
    user_id VARCHAR(24) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_id VARCHAR(255) UNIQUE NOT NULL,
    refresh_token TEXT,
    session_data JSONB,
    user_agent TEXT,
    ip_address INET,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for sessions table
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_session_id ON sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

-- Create presets table
CREATE TABLE IF NOT EXISTS presets (
    id VARCHAR(24) PRIMARY KEY DEFAULT encode(gen_random_bytes(12), 'hex'),
    user_id VARCHAR(24) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    preset_id VARCHAR(24) UNIQUE, -- For external preset tracking
    title VARCHAR(255) NOT NULL,
    endpoint VARCHAR(100) NOT NULL,
    model VARCHAR(100),
    conversation_id VARCHAR(24),
    agent_options JSONB,
    prompt_prefix TEXT,
    temperature DECIMAL(3,2),
    top_p DECIMAL(3,2),
    top_k INTEGER,
    context_strategy VARCHAR(50),
    resend_files BOOLEAN DEFAULT false,
    image_detail VARCHAR(20),
    icon_url TEXT,
    spec VARCHAR(50),
    tools JSONB,
    shared BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for presets table
CREATE INDEX IF NOT EXISTS idx_presets_user_id ON presets(user_id);
CREATE INDEX IF NOT EXISTS idx_presets_preset_id ON presets(preset_id);
CREATE INDEX IF NOT EXISTS idx_presets_endpoint ON presets(endpoint);
CREATE INDEX IF NOT EXISTS idx_presets_shared ON presets(shared) WHERE shared = true;

-- Create balances table (for user credits/tokens)
CREATE TABLE IF NOT EXISTS balances (
    id VARCHAR(24) PRIMARY KEY DEFAULT encode(gen_random_bytes(12), 'hex'),
    user_id VARCHAR(24) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_credit DECIMAL(15,2) DEFAULT 0,
    token_credit_refresh_time TIMESTAMP WITH TIME ZONE,
    rate_limit_requests INTEGER DEFAULT 0,
    rate_limit_request_refresh_time TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for balances table
CREATE INDEX IF NOT EXISTS idx_balances_user_id ON balances(user_id);

-- Create plugin_auths table (for plugin authentication data)
CREATE TABLE IF NOT EXISTS plugin_auths (
    id VARCHAR(24) PRIMARY KEY DEFAULT encode(gen_random_bytes(12), 'hex'),
    user_id VARCHAR(24) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plugin_key VARCHAR(100) NOT NULL,
    auth_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, plugin_key)
);

-- Create indexes for plugin_auths table
CREATE INDEX IF NOT EXISTS idx_plugin_auths_user_id ON plugin_auths(user_id);
CREATE INDEX IF NOT EXISTS idx_plugin_auths_plugin_key ON plugin_auths(plugin_key);

-- Create agents table (for AI agents/assistants)
CREATE TABLE IF NOT EXISTS agents (
    id VARCHAR(24) PRIMARY KEY DEFAULT encode(gen_random_bytes(12), 'hex'),
    user_id VARCHAR(24) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    agent_id VARCHAR(24) UNIQUE, -- For external agent tracking
    name VARCHAR(255) NOT NULL,
    description TEXT,
    instructions TEXT,
    model VARCHAR(100),
    provider VARCHAR(50),
    tools JSONB,
    tool_resources JSONB,
    metadata JSONB,
    created_by VARCHAR(24) REFERENCES users(id),
    avatar JSONB,
    shared BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for agents table
CREATE INDEX IF NOT EXISTS idx_agents_user_id ON agents(user_id);
CREATE INDEX IF NOT EXISTS idx_agents_agent_id ON agents(agent_id);
CREATE INDEX IF NOT EXISTS idx_agents_created_by ON agents(created_by);
CREATE INDEX IF NOT EXISTS idx_agents_shared ON agents(shared) WHERE shared = true;

-- Create functions for automatic timestamp updates
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON conversations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_messages_updated_at BEFORE UPDATE ON messages
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_files_updated_at BEFORE UPDATE ON files
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sessions_updated_at BEFORE UPDATE ON sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_presets_updated_at BEFORE UPDATE ON presets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_balances_updated_at BEFORE UPDATE ON balances
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_plugin_auths_updated_at BEFORE UPDATE ON plugin_auths
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_agents_updated_at BEFORE UPDATE ON agents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create views for common queries
CREATE OR REPLACE VIEW conversation_with_stats AS
SELECT 
    c.*,
    COUNT(m.id) as message_count,
    MAX(m.created_at) as last_message_at,
    SUM(m.token_count) as total_tokens
FROM conversations c
LEFT JOIN messages m ON c.id = m.conversation_id
GROUP BY c.id;

-- Create view for user statistics
CREATE OR REPLACE VIEW user_stats AS
SELECT 
    u.id,
    u.email,
    u.username,
    u.name,
    u.created_at as user_created_at,
    COUNT(DISTINCT c.id) as conversation_count,
    COUNT(DISTINCT m.id) as message_count,
    SUM(m.token_count) as total_tokens_used,
    MAX(c.updated_at) as last_conversation_activity,
    COUNT(DISTINCT f.id) as file_count
FROM users u
LEFT JOIN conversations c ON u.id = c.user_id
LEFT JOIN messages m ON u.id = m.user_id
LEFT JOIN files f ON u.id = f.user_id
GROUP BY u.id, u.email, u.username, u.name, u.created_at;

-- Insert default admin user (password should be changed immediately)
-- Password is 'admin123' - CHANGE THIS IN PRODUCTION!
INSERT INTO users (id, email, username, name, password, role) 
VALUES (
    'admin001000000000000000',
    'admin@librechat.local',
    'admin',
    'Administrator',
    '$2b$12$Z.KQZnCzpX9qNKfGQ1fUNOZT6JG8s5t.KHG7t8FkKQZ8K4j5L6M1i', -- admin123
    'admin'
) ON CONFLICT (email) DO NOTHING;

-- Create schema version tracking
CREATE TABLE IF NOT EXISTS schema_versions (
    version VARCHAR(20) PRIMARY KEY,
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    description TEXT
);

INSERT INTO schema_versions (version, description) 
VALUES ('1.0.0', 'Initial LibreChat PostgreSQL schema') 
ON CONFLICT (version) DO NOTHING;

-- Additional tables to complete MongoDB feature parity

-- Create shared_links table (for conversation sharing)
CREATE TABLE IF NOT EXISTS shared_links (
    id VARCHAR(24) PRIMARY KEY DEFAULT encode(gen_random_bytes(12), 'hex'),
    conversation_id VARCHAR(24) NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    user_id VARCHAR(24) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    share_id VARCHAR(50) UNIQUE NOT NULL,
    title VARCHAR(255),
    description TEXT,
    is_public BOOLEAN DEFAULT false,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for shared_links table
CREATE INDEX IF NOT EXISTS idx_shared_links_conversation_id ON shared_links(conversation_id);
CREATE INDEX IF NOT EXISTS idx_shared_links_user_id ON shared_links(user_id);
CREATE INDEX IF NOT EXISTS idx_shared_links_share_id ON shared_links(share_id);
CREATE INDEX IF NOT EXISTS idx_shared_links_public ON shared_links(is_public) WHERE is_public = true;

-- Create transactions table (for balance/credit tracking)
CREATE TABLE IF NOT EXISTS transactions (
    id VARCHAR(24) PRIMARY KEY DEFAULT encode(gen_random_bytes(12), 'hex'),
    user_id VARCHAR(24) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    conversation_id VARCHAR(24) REFERENCES conversations(id) ON DELETE SET NULL,
    message_id VARCHAR(24) REFERENCES messages(id) ON DELETE SET NULL,
    type VARCHAR(50) NOT NULL, -- 'credit', 'debit', 'bonus', 'refund'
    amount DECIMAL(15,2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'USD',
    description TEXT,
    provider VARCHAR(50), -- 'openai', 'anthropic', etc.
    model VARCHAR(100),
    token_count INTEGER,
    raw_amount DECIMAL(15,8), -- Raw amount in provider currency
    rate DECIMAL(15,8), -- Exchange rate used
    status VARCHAR(20) DEFAULT 'completed', -- 'pending', 'completed', 'failed'
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for transactions table
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_conversation_id ON transactions(conversation_id);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at);

-- Create tool_calls table (for tracking tool/function calls)
CREATE TABLE IF NOT EXISTS tool_calls (
    id VARCHAR(24) PRIMARY KEY DEFAULT encode(gen_random_bytes(12), 'hex'),
    message_id VARCHAR(24) NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    conversation_id VARCHAR(24) NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    user_id VARCHAR(24) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tool_call_id VARCHAR(100) NOT NULL,
    tool_name VARCHAR(100) NOT NULL,
    tool_input JSONB,
    tool_output JSONB,
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'completed', 'failed'
    error_message TEXT,
    execution_time INTEGER, -- milliseconds
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for tool_calls table
CREATE INDEX IF NOT EXISTS idx_tool_calls_message_id ON tool_calls(message_id);
CREATE INDEX IF NOT EXISTS idx_tool_calls_conversation_id ON tool_calls(conversation_id);
CREATE INDEX IF NOT EXISTS idx_tool_calls_user_id ON tool_calls(user_id);
CREATE INDEX IF NOT EXISTS idx_tool_calls_tool_name ON tool_calls(tool_name);
CREATE INDEX IF NOT EXISTS idx_tool_calls_status ON tool_calls(status);

-- Create violations table (for tracking user violations/moderation)
CREATE TABLE IF NOT EXISTS violations (
    id VARCHAR(24) PRIMARY KEY DEFAULT encode(gen_random_bytes(12), 'hex'),
    user_id VARCHAR(24) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL, -- 'rate_limit', 'content_policy', 'abuse', etc.
    severity VARCHAR(20) DEFAULT 'low', -- 'low', 'medium', 'high', 'critical'
    reason TEXT,
    metadata JSONB,
    ip_address INET,
    user_agent TEXT,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for violations table
CREATE INDEX IF NOT EXISTS idx_violations_user_id ON violations(user_id);
CREATE INDEX IF NOT EXISTS idx_violations_type ON violations(type);
CREATE INDEX IF NOT EXISTS idx_violations_severity ON violations(severity);
CREATE INDEX IF NOT EXISTS idx_violations_expires_at ON violations(expires_at);

-- Create keys table (for API key management)
CREATE TABLE IF NOT EXISTS keys (
    id VARCHAR(24) PRIMARY KEY DEFAULT encode(gen_random_bytes(12), 'hex'),
    user_id VARCHAR(24) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    key_hash VARCHAR(255) NOT NULL, -- Hashed API key
    key_prefix VARCHAR(20) NOT NULL, -- First few chars for identification
    permissions JSONB, -- Array of permissions
    rate_limit INTEGER,
    expires_at TIMESTAMP WITH TIME ZONE,
    last_used_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for keys table
CREATE INDEX IF NOT EXISTS idx_keys_user_id ON keys(user_id);
CREATE INDEX IF NOT EXISTS idx_keys_key_hash ON keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_keys_key_prefix ON keys(key_prefix);
CREATE INDEX IF NOT EXISTS idx_keys_is_active ON keys(is_active) WHERE is_active = true;

-- Create triggers for automatic timestamp updates on new tables
CREATE TRIGGER update_shared_links_updated_at BEFORE UPDATE ON shared_links
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON transactions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tool_calls_updated_at BEFORE UPDATE ON tool_calls
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_violations_updated_at BEFORE UPDATE ON violations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_keys_updated_at BEFORE UPDATE ON keys
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Additional MongoDB schema coverage (missing tables)

-- Create actions table (for action prototypes/plugins)
CREATE TABLE IF NOT EXISTS actions (
    id VARCHAR(24) PRIMARY KEY DEFAULT encode(gen_random_bytes(12), 'hex'),
    user_id VARCHAR(24) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action_id VARCHAR(100) NOT NULL,
    type VARCHAR(50) DEFAULT 'action_prototype',
    settings JSONB,
    agent_id VARCHAR(24),
    assistant_id VARCHAR(100),
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for actions table
CREATE INDEX IF NOT EXISTS idx_actions_user_id ON actions(user_id);
CREATE INDEX IF NOT EXISTS idx_actions_action_id ON actions(action_id);
CREATE INDEX IF NOT EXISTS idx_actions_agent_id ON actions(agent_id);

-- Create banners table (for system announcements)
CREATE TABLE IF NOT EXISTS banners (
    id VARCHAR(24) PRIMARY KEY DEFAULT encode(gen_random_bytes(12), 'hex'),
    banner_id VARCHAR(100) UNIQUE NOT NULL,
    message TEXT NOT NULL,
    display_from TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    display_to TIMESTAMP WITH TIME ZONE,
    type VARCHAR(20) DEFAULT 'banner', -- 'banner', 'popup'
    is_public BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for banners table
CREATE INDEX IF NOT EXISTS idx_banners_banner_id ON banners(banner_id);
CREATE INDEX IF NOT EXISTS idx_banners_display_from ON banners(display_from);
CREATE INDEX IF NOT EXISTS idx_banners_display_to ON banners(display_to);
CREATE INDEX IF NOT EXISTS idx_banners_is_public ON banners(is_public) WHERE is_public = true;

-- Create memory_entries table (for user memory/context)
CREATE TABLE IF NOT EXISTS memory_entries (
    id VARCHAR(24) PRIMARY KEY DEFAULT encode(gen_random_bytes(12), 'hex'),
    user_id VARCHAR(24) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    key VARCHAR(255) NOT NULL,
    value TEXT NOT NULL,
    token_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for memory_entries table
CREATE INDEX IF NOT EXISTS idx_memory_entries_user_id ON memory_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_memory_entries_key ON memory_entries(key);
CREATE UNIQUE INDEX IF NOT EXISTS idx_memory_entries_user_key ON memory_entries(user_id, key);

-- Create projects table (for project management)
CREATE TABLE IF NOT EXISTS projects (
    id VARCHAR(24) PRIMARY KEY DEFAULT encode(gen_random_bytes(12), 'hex'),
    name VARCHAR(255) NOT NULL,
    prompt_group_ids VARCHAR(24)[],
    agent_ids VARCHAR(24)[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for projects table
CREATE INDEX IF NOT EXISTS idx_projects_name ON projects(name);
CREATE INDEX IF NOT EXISTS idx_projects_agent_ids ON projects USING GIN(agent_ids);

-- Create prompt_groups table (for prompt organization)
CREATE TABLE IF NOT EXISTS prompt_groups (
    id VARCHAR(24) PRIMARY KEY DEFAULT encode(gen_random_bytes(12), 'hex'),
    name VARCHAR(255) NOT NULL,
    number_of_generations INTEGER DEFAULT 0,
    oneliner TEXT DEFAULT '',
    category VARCHAR(255) DEFAULT '',
    project_ids VARCHAR(24)[],
    production_id VARCHAR(24),
    author_id VARCHAR(24) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    author_name VARCHAR(255) NOT NULL,
    command VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for prompt_groups table
CREATE INDEX IF NOT EXISTS idx_prompt_groups_name ON prompt_groups(name);
CREATE INDEX IF NOT EXISTS idx_prompt_groups_category ON prompt_groups(category);
CREATE INDEX IF NOT EXISTS idx_prompt_groups_author_id ON prompt_groups(author_id);
CREATE INDEX IF NOT EXISTS idx_prompt_groups_command ON prompt_groups(command);

-- Create prompts table (for prompt templates)
CREATE TABLE IF NOT EXISTS prompts (
    id VARCHAR(24) PRIMARY KEY DEFAULT encode(gen_random_bytes(12), 'hex'),
    group_id VARCHAR(24) NOT NULL REFERENCES prompt_groups(id) ON DELETE CASCADE,
    author_id VARCHAR(24) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    prompt TEXT NOT NULL,
    type VARCHAR(20) NOT NULL, -- 'text', 'chat'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for prompts table
CREATE INDEX IF NOT EXISTS idx_prompts_group_id ON prompts(group_id);
CREATE INDEX IF NOT EXISTS idx_prompts_author_id ON prompts(author_id);
CREATE INDEX IF NOT EXISTS idx_prompts_type ON prompts(type);

-- Create tokens table (for authentication tokens)
CREATE TABLE IF NOT EXISTS tokens (
    id VARCHAR(24) PRIMARY KEY DEFAULT encode(gen_random_bytes(12), 'hex'),
    user_id VARCHAR(24) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    email VARCHAR(255),
    type VARCHAR(50),
    identifier VARCHAR(255),
    token TEXT NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for tokens table
CREATE INDEX IF NOT EXISTS idx_tokens_user_id ON tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_tokens_token ON tokens(token);
CREATE INDEX IF NOT EXISTS idx_tokens_expires_at ON tokens(expires_at);

-- Create groups table (for user groups/teams)
CREATE TABLE IF NOT EXISTS groups (
    id VARCHAR(24) PRIMARY KEY DEFAULT encode(gen_random_bytes(12), 'hex'),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    email VARCHAR(255),
    avatar TEXT,
    member_ids TEXT[],
    source VARCHAR(20) DEFAULT 'local', -- 'local', 'entra'
    id_on_the_source VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for groups table
CREATE INDEX IF NOT EXISTS idx_groups_name ON groups(name);
CREATE INDEX IF NOT EXISTS idx_groups_email ON groups(email);
CREATE INDEX IF NOT EXISTS idx_groups_source ON groups(source);
CREATE INDEX IF NOT EXISTS idx_groups_id_on_source ON groups(id_on_the_source);
CREATE INDEX IF NOT EXISTS idx_groups_member_ids ON groups USING GIN(member_ids);
CREATE UNIQUE INDEX IF NOT EXISTS idx_groups_external_unique ON groups(id_on_the_source, source) 
    WHERE id_on_the_source IS NOT NULL;

-- Create categories table (for general categorization)
CREATE TABLE IF NOT EXISTS categories (
    id VARCHAR(24) PRIMARY KEY DEFAULT encode(gen_random_bytes(12), 'hex'),
    label VARCHAR(255) UNIQUE NOT NULL,
    value VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for categories table
CREATE INDEX IF NOT EXISTS idx_categories_label ON categories(label);
CREATE INDEX IF NOT EXISTS idx_categories_value ON categories(value);

-- Create conversation_tags table (for tagging conversations)
CREATE TABLE IF NOT EXISTS conversation_tags (
    id VARCHAR(24) PRIMARY KEY DEFAULT encode(gen_random_bytes(12), 'hex'),
    tag VARCHAR(255),
    user_id VARCHAR(24) REFERENCES users(id) ON DELETE CASCADE,
    description TEXT,
    count INTEGER DEFAULT 0,
    position INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for conversation_tags table
CREATE INDEX IF NOT EXISTS idx_conversation_tags_tag ON conversation_tags(tag);
CREATE INDEX IF NOT EXISTS idx_conversation_tags_user_id ON conversation_tags(user_id);
CREATE INDEX IF NOT EXISTS idx_conversation_tags_position ON conversation_tags(position);
CREATE UNIQUE INDEX IF NOT EXISTS idx_conversation_tags_unique ON conversation_tags(tag, user_id);

-- Create agent_categories table (for categorizing agents)
CREATE TABLE IF NOT EXISTS agent_categories (
    id VARCHAR(24) PRIMARY KEY DEFAULT encode(gen_random_bytes(12), 'hex'),
    value VARCHAR(255) UNIQUE NOT NULL,
    label VARCHAR(255) NOT NULL,
    description TEXT DEFAULT '',
    order_num INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for agent_categories table
CREATE INDEX IF NOT EXISTS idx_agent_categories_value ON agent_categories(value);
CREATE INDEX IF NOT EXISTS idx_agent_categories_order ON agent_categories(order_num);
CREATE INDEX IF NOT EXISTS idx_agent_categories_active ON agent_categories(is_active) WHERE is_active = true;

-- Create roles table (for user roles and permissions)
CREATE TABLE IF NOT EXISTS roles (
    id VARCHAR(24) PRIMARY KEY DEFAULT encode(gen_random_bytes(12), 'hex'),
    name VARCHAR(255) UNIQUE NOT NULL,
    permissions JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for roles table
CREATE INDEX IF NOT EXISTS idx_roles_name ON roles(name);

-- Create triggers for automatic timestamp updates on new tables
CREATE TRIGGER update_actions_updated_at BEFORE UPDATE ON actions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_banners_updated_at BEFORE UPDATE ON banners
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_memory_entries_updated_at BEFORE UPDATE ON memory_entries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_prompt_groups_updated_at BEFORE UPDATE ON prompt_groups
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_prompts_updated_at BEFORE UPDATE ON prompts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_groups_updated_at BEFORE UPDATE ON groups
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON categories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_conversation_tags_updated_at BEFORE UPDATE ON conversation_tags
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_agent_categories_updated_at BEFORE UPDATE ON agent_categories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_roles_updated_at BEFORE UPDATE ON roles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMIT;
