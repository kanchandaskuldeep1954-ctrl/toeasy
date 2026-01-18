-- Create ENUM types first
CREATE TYPE tier_enum AS ENUM ('basic', 'pro', 'enterprise');
CREATE TYPE subscription_status_enum AS ENUM ('active', 'cancelled', 'expired');
CREATE TYPE query_type_enum AS ENUM ('sql', 'natural');
CREATE TYPE payment_status_enum AS ENUM ('pending', 'completed', 'failed');

-- Create Users table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255),
  avatar_url VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Create Subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tier tier_enum DEFAULT 'basic',
  status subscription_status_enum DEFAULT 'active',
  current_period_start TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  current_period_end TIMESTAMP,
  renewal_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);

-- Create Workspaces table
CREATE TABLE IF NOT EXISTS workspaces (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  is_archived BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_workspaces_user_id ON workspaces(user_id);

-- Create Datasets table
CREATE TABLE IF NOT EXISTS datasets (
  id SERIAL PRIMARY KEY,
  workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  file_name VARCHAR(255),
  row_count INTEGER DEFAULT 0,
  column_count INTEGER DEFAULT 0,
  file_size BIGINT DEFAULT 0,
  raw_data JSONB,
  analysis_result JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_datasets_workspace_id ON datasets(workspace_id);
CREATE INDEX IF NOT EXISTS idx_datasets_user_id ON datasets(user_id);

-- Create Dashboards table
CREATE TABLE IF NOT EXISTS dashboards (
  id SERIAL PRIMARY KEY,
  workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  layout JSONB DEFAULT '[]',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_dashboards_workspace_id ON dashboards(workspace_id);

-- Create Queries table
CREATE TABLE IF NOT EXISTS queries (
  id SERIAL PRIMARY KEY,
  workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  dataset_id INTEGER NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
  executed_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  query_text TEXT NOT NULL,
  query_type query_type_enum DEFAULT 'sql',
  result_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_queries_dataset_id ON queries(dataset_id);
CREATE INDEX IF NOT EXISTS idx_queries_executed_by ON queries(executed_by);

-- Create Validation Rules table
CREATE TABLE IF NOT EXISTS validation_rules (
  id SERIAL PRIMARY KEY,
  dataset_id INTEGER NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  rule_type VARCHAR(255) NOT NULL,
  rule_definition JSONB,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_validation_rules_dataset_id ON validation_rules(dataset_id);

-- Create Activity Logs table
CREATE TABLE IF NOT EXISTS activity_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workspace_id INTEGER REFERENCES workspaces(id) ON DELETE SET NULL,
  action VARCHAR(255) NOT NULL,
  resource_type VARCHAR(255),
  resource_id INTEGER,
  details TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_workspace_id ON activity_logs(workspace_id);

-- Create Payment Orders table
CREATE TABLE IF NOT EXISTS payment_orders (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id VARCHAR(255) NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'INR',
  order_id VARCHAR(255) UNIQUE NOT NULL,
  cashfree_order_id VARCHAR(255),
  status payment_status_enum DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_payment_orders_user_id ON payment_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_orders_status ON payment_orders(status);

-- Performance-optimized composite indexes
CREATE INDEX IF NOT EXISTS idx_datasets_workspace_user ON datasets(workspace_id, user_id);
CREATE INDEX IF NOT EXISTS idx_dashboards_workspace_created ON dashboards(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_queries_dataset_created ON queries(dataset_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_queries_workspace_created ON queries(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_validation_rules_dataset_active ON validation_rules(dataset_id, is_active);
CREATE INDEX IF NOT EXISTS idx_activity_logs_workspace_created ON activity_logs(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_orders_user_created ON payment_orders(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_subscriptions_renewal ON subscriptions(renewal_date);

-- Timestamp-based indexes for range queries and pagination
CREATE INDEX IF NOT EXISTS idx_datasets_created_at ON datasets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_queries_created_at ON queries(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at DESC);

-- JSONB GIN indexes for JSON searches and filtering
CREATE INDEX IF NOT EXISTS idx_datasets_analysis_jsonb ON datasets USING gin(analysis_result);
CREATE INDEX IF NOT EXISTS idx_dashboards_layout_jsonb ON dashboards USING gin(layout);
CREATE INDEX IF NOT EXISTS idx_validation_rules_jsonb ON validation_rules USING gin(rule_definition);
CREATE INDEX IF NOT EXISTS idx_datasets_raw_data_jsonb ON datasets USING gin(raw_data);

-- Insert test user
INSERT INTO users (email, password_hash, full_name) VALUES 
('test@example.com', '$2a$12$N9qo8uLOickgx2ZMRZoMyeIjZAgcg7b3XeKeUxWdeS86E36gZvQm2', 'Test User')
ON CONFLICT (email) DO NOTHING;

-- Insert test subscription
INSERT INTO subscriptions (user_id, tier, status, renewal_date) 
SELECT id, 'pro'::tier_enum, 'active'::subscription_status_enum, NOW() + INTERVAL '30 days' FROM users WHERE email = 'test@example.com'
ON CONFLICT DO NOTHING;

-- Insert test workspace
INSERT INTO workspaces (user_id, name, description) 
SELECT id, 'Default Workspace', 'My first workspace' FROM users WHERE email = 'test@example.com'
ON CONFLICT DO NOTHING;

