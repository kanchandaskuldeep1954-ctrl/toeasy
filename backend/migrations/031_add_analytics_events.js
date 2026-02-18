/**
 * Migration: 031_add_analytics_events.js
 * Adds lightweight product telemetry for Decision Room MVP KPIs.
 */

export async function up(knex) {
  if (await knex.schema.hasTable('analytics_events')) {
    return;
  }

  await knex.schema.createTable('analytics_events', (table) => {
    table.bigIncrements('id').primary();
    table.integer('workspace_id').references('id').inTable('workspaces').onDelete('CASCADE');
    table.integer('room_id').references('id').inTable('analysis_rooms').onDelete('SET NULL');
    table.integer('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.string('event_type').notNullable();
    table.jsonb('metadata').notNullable().defaultTo(knex.raw(`'{}'::jsonb`));
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());

    table.index(['workspace_id', 'created_at']);
    table.index(['workspace_id', 'event_type', 'created_at']);
    table.index(['room_id', 'created_at']);
    table.index(['user_id', 'created_at']);
  });
}

export async function down(knex) {
  await knex.schema.dropTableIfExists('analytics_events');
}

