/**
 * Migration: 035_decision_room_chat_context.js
 * Adds explicit Decision Room -> Chat channel mapping for context-aware collaboration.
 */

export async function up(knex) {
    await knex.schema.createTable('decision_room_chat_channels', (table) => {
        table.increments('id').primary();
        table.integer('workspace_id').notNullable().references('id').inTable('workspaces').onDelete('CASCADE');
        table.integer('project_id').references('id').inTable('projects').onDelete('SET NULL');
        table.integer('room_id').notNullable().references('id').inTable('analysis_rooms').onDelete('CASCADE');
        table.uuid('channel_id').notNullable().references('id').inTable('channels').onDelete('CASCADE');
        table.integer('created_by').references('id').inTable('users').onDelete('SET NULL');
        table.timestamps(true, true);

        table.unique(['workspace_id', 'room_id']);
        table.unique(['channel_id']);
        table.index(['workspace_id', 'project_id']);
        table.index(['workspace_id', 'room_id', 'channel_id']);
    });
}

export async function down(knex) {
    await knex.schema.dropTableIfExists('decision_room_chat_channels');
}

