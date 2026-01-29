/**
 * Migration: Create metrics and metric_usage tables
 * Implements centralized metrics library for calculated fields
 */

export const up = async function (knex) {
    // Create metrics table
    await knex.schema.createTable('metrics', (table) => {
        table.increments('id').primary();
        table.integer('workspace_id').unsigned().references('id').inTable('workspaces').onDelete('CASCADE');
        table.string('name', 255).notNullable();
        table.text('formula').notNullable();
        table.text('description');
        table.string('category', 100);
        table.integer('owner_id').unsigned().references('id').inTable('users');
        table.boolean('is_certified').defaultTo(false);
        table.string('format_type', 50).defaultTo('number'); // 'number', 'currency', 'percentage', 'integer'
        table.integer('decimal_places').defaultTo(2);
        table.jsonb('dependencies'); // Array of column names or metric IDs this depends on
        table.jsonb('tags'); // Array of string tags
        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.timestamp('updated_at').defaultTo(knex.fn.now());

        table.index(['workspace_id']);
        table.index(['category']);
        table.index(['is_certified']);
    });

    // Create metric_usage tracking table
    await knex.schema.createTable('metric_usage', (table) => {
        table.increments('id').primary();
        table.integer('metric_id').unsigned().references('id').inTable('metrics').onDelete('CASCADE');
        table.string('used_in_type', 50).notNullable(); // 'dashboard', 'report', 'dataflow', 'kpi'
        table.integer('used_in_id').notNullable();
        table.timestamp('created_at').defaultTo(knex.fn.now());

        table.index(['metric_id']);
        table.index(['used_in_type', 'used_in_id']);
    });

    // Create metric_versions for tracking formula changes
    await knex.schema.createTable('metric_versions', (table) => {
        table.increments('id').primary();
        table.integer('metric_id').unsigned().references('id').inTable('metrics').onDelete('CASCADE');
        table.text('formula').notNullable();
        table.text('change_reason');
        table.integer('changed_by').unsigned().references('id').inTable('users');
        table.timestamp('created_at').defaultTo(knex.fn.now());

        table.index(['metric_id']);
    });

    console.log('Created metrics, metric_usage, and metric_versions tables');
};

export const down = async function (knex) {
    await knex.schema.dropTableIfExists('metric_versions');
    await knex.schema.dropTableIfExists('metric_usage');
    await knex.schema.dropTableIfExists('metrics');
    console.log('Dropped metrics tables');
};
