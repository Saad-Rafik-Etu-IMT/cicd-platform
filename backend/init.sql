-- ========================================
-- CI/CD Platform Database Schema
-- ========================================

-- Users table (with GitHub OAuth support)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    github_id BIGINT UNIQUE,
    username VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    password_hash VARCHAR(255),
    avatar_url VARCHAR(500),
    github_access_token TEXT,
    role VARCHAR(50) DEFAULT 'viewer',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create unique index on username only for non-github users
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_unique 
ON users (username) WHERE github_id IS NULL;

-- Pipelines table
CREATE TABLE IF NOT EXISTS pipelines (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    status VARCHAR(50) DEFAULT 'pending',
    commit_hash VARCHAR(255),
    branch VARCHAR(255) DEFAULT 'master',
    repo_url VARCHAR(500),
    trigger_type VARCHAR(50) DEFAULT 'manual',
    sonar_project_key VARCHAR(255),
    sonar_quality_gate VARCHAR(50),
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Pipeline logs table
CREATE TABLE IF NOT EXISTS pipeline_logs (
    id SERIAL PRIMARY KEY,
    pipeline_id INTEGER REFERENCES pipelines(id) ON DELETE CASCADE,
    step_name VARCHAR(255),
    step_order INTEGER,
    status VARCHAR(50) DEFAULT 'pending',
    output TEXT,
    duration_ms INTEGER,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Deployments table (for rollback tracking)
CREATE TABLE IF NOT EXISTS deployments (
    id SERIAL PRIMARY KEY,
    pipeline_id INTEGER REFERENCES pipelines(id),
    version VARCHAR(255),
    docker_image VARCHAR(500),
    status VARCHAR(50) DEFAULT 'active',
    deployed_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_pipelines_status ON pipelines(status);
CREATE INDEX IF NOT EXISTS idx_pipelines_created_at ON pipelines(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pipeline_logs_pipeline_id ON pipeline_logs(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_deployments_status ON deployments(status);

-- Environment variables table (secrets)
CREATE TABLE IF NOT EXISTS env_variables (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    value TEXT NOT NULL,
    is_secret BOOLEAN DEFAULT true,
    description VARCHAR(500),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Note: Default users removed - first GitHub OAuth user becomes admin
