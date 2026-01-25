/**
 * Migration: Create shared_links and workspace_tabs tables
 * 
 * shared_links: Stores frozen JSON snapshots of dashboards/reports for public sharing
 * workspace_tabs: Stores user's saved tabs per workspace (like browser favorites)
 */

exports.up = async function (knex) {
    // Create shared_links table
    await knex.raw(`
        CREATE TABLE IF NOT EXISTS shared_links (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
            
            -- What is being shared
            resource_type VARCHAR(20) NOT NULL CHECK (resource_type IN ('dashboard', 'report')),
            resource_id INTEGER NOT NULL,
            
            -- The frozen snapshot (JSON blob of the rendered content)
            snapshot JSONB NOT NULL,
            
            -- Share settings
            share_token VARCHAR(64) UNIQUE NOT NULL,
            title VARCHAR(255) NOT NULL,
            is_active BOOLEAN DEFAULT true,
            password_hash VARCHAR(255),
            
            -- Metadata
            view_count INTEGER DEFAULT 0,
            expires_at TIMESTAMP WITH TIME ZONE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        CREATE INDEX IF NOT EXISTS idx_shared_links_token ON shared_links(share_token);
        CREATE INDEX IF NOT EXISTS idx_shared_links_user ON shared_links(user_id);
    `);

    // Create workspace_tabs table
    await knex.raw(`
        CREATE TABLE IF NOT EXISTS workspace_tabs (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
            
            -- Tab content
            tab_type VARCHAR(20) NOT NULL CHECK (tab_type IN ('dashboard', 'report', 'dataset')),
            resource_id INTEGER NOT NULL,
            tab_name VARCHAR(100) NOT NULL,
            tab_order INTEGER DEFAULT 0,
            
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            
            UNIQUE(user_id, workspace_id, tab_type, resource_id)
        );
        
        CREATE INDEX IF NOT EXISTS idx_workspace_tabs_user ON workspace_tabs(user_id, workspace_id);
    `);
};

exports.down = async function (knex) {
    await knex.raw('DROP TABLE IF EXISTS workspace_tabs CASCADE');
    await knex.raw('DROP TABLE IF EXISTS shared_links CASCADE');
};
