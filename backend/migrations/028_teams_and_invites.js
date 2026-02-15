/**
 * Migration: 028_teams_and_invites.js
 * Creates tables for Organizations, Workspace Members, and Invitations
 */

export async function up(knex) {
    // ===== ORGANIZATIONS =====
    // Lightweight for MVP - just a grouping mechanism for now
    await knex.schema.createTable('organizations', (table) => {
        table.increments('id').primary();
        table.string('name').notNullable();
        table.string('slug').unique(); // Optional for now, useful for future
        table.string('billing_email');
        table.integer('owner_id').references('id').inTable('users').onDelete('CASCADE');
        table.timestamps(true, true);
    });

    // ===== WORKSPACE MEMBERS =====
    // Links users to workspaces with specific roles
    await knex.schema.createTable('workspace_members', (table) => {
        table.increments('id').primary();
        table.integer('workspace_id').notNullable().references('id').inTable('workspaces').onDelete('CASCADE');
        table.integer('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
        table.string('role').defaultTo('viewer'); // 'admin', 'editor', 'viewer'
        table.integer('invited_by').references('id').inTable('users');
        table.timestamps(true, true);

        // Ensure user can only be added once to a workspace
        table.unique(['workspace_id', 'user_id']);
    });

    // ===== INVITATIONS =====
    // Pending invites sent via email
    await knex.schema.createTable('invitations', (table) => {
        table.increments('id').primary();
        table.integer('workspace_id').notNullable().references('id').inTable('workspaces').onDelete('CASCADE');
        table.string('email').notNullable();
        table.string('role').defaultTo('viewer'); // 'admin', 'editor', 'viewer'
        table.string('token').notNullable().unique();
        table.integer('invited_by').references('id').inTable('users');
        table.string('status').defaultTo('pending'); // 'pending', 'accepted', 'expired'
        table.timestamp('expires_at').defaultTo(knex.raw("NOW() + INTERVAL '7 days'"));
        table.timestamps(true, true);

        // Index for faster lookups
        table.index(['token']);
        table.index(['email']);
    });

    // ===== MIGRATION: ADD EXISTING OWNERS AS ADMINS =====
    // For every existing workspace, add the owner as an 'admin' in workspace_members
    // This ensures backward compatibility
    await knex.raw(`
        INSERT INTO workspace_members (workspace_id, user_id, role)
        SELECT id, user_id, 'admin'
        FROM workspaces
    `);
}

export async function down(knex) {
    await knex.schema.dropTableIfExists('invitations');
    await knex.schema.dropTableIfExists('workspace_members');
    await knex.schema.dropTableIfExists('organizations');
}
