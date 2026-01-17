/**
 * Migration: 002_cleaning_enhancement
 * 
 * Adds support for:
 * - Cleaned data storage (separate from raw_data)
 * - Cleaning confirmation workflow
 * - Cleaning history/audit trail
 * - Custom recovery scripts
 * - Dataflows and pipeline automation
 */

export const up = async function (knex) {
    // Add new columns to datasets table
    await knex.schema.alterTable('datasets', (table) => {
        table.json('cleaned_data'); // Stores cleaned version of data
        table.boolean('cleaning_confirmed').defaultTo(false); // User confirmed cleaning
        table.json('cleaning_summary'); // Summary of cleaning operations
        table.json('quarantined_data'); // Rows that failed validation
        table.integer('health_score').defaultTo(100); // Data quality score 0-100
    });

    // Cleaning history for audit trail
    await knex.schema.createTable('cleaning_history', (table) => {
        table.increments('id').primary();
        table.integer('dataset_id').unsigned().notNullable().references('datasets.id').onDelete('CASCADE');
        table.integer('user_id').unsigned().notNullable().references('users.id').onDelete('CASCADE');
        table.string('action_type', 50).notNullable(); // 'analysis', 'rule_applied', 'recovery', 'confirmed', 'reverted'
        table.json('details'); // Full details of the action
        table.integer('rows_affected').defaultTo(0);
        table.integer('health_score_before');
        table.integer('health_score_after');
        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.index('dataset_id');
        table.index('user_id');
        table.index('action_type');
    });

    // Custom recovery scripts
    await knex.schema.createTable('recovery_scripts', (table) => {
        table.increments('id').primary();
        table.integer('dataset_id').unsigned().references('datasets.id').onDelete('CASCADE');
        table.integer('user_id').unsigned().notNullable().references('users.id').onDelete('CASCADE');
        table.integer('workspace_id').unsigned().references('workspaces.id').onDelete('CASCADE');
        table.string('name').notNullable();
        table.text('description');
        table.string('target_column'); // Which column this script targets
        table.string('category').defaultTo('Recovery'); // 'Recovery', 'Audit', 'Transform'
        table.text('expression'); // Validation expression
        table.text('heal_function'); // Recovery/heal JavaScript code
        table.text('reasoning'); // AI reasoning for this rule
        table.boolean('is_active').defaultTo(true);
        table.boolean('is_template').defaultTo(false); // Can be reused across datasets
        table.json('test_results'); // Last test run results
        table.timestamps(true, true);
        table.index('dataset_id');
        table.index('user_id');
        table.index('workspace_id');
        table.index('is_template');
    });

    // Dataflows table for pipeline automation
    await knex.schema.createTable('dataflows', (table) => {
        table.increments('id').primary();
        table.integer('workspace_id').unsigned().notNullable().references('workspaces.id').onDelete('CASCADE');
        table.integer('user_id').unsigned().notNullable().references('users.id').onDelete('CASCADE');
        table.string('name').notNullable();
        table.text('description');
        table.json('pipeline'); // Array of steps: [{type, config, order}]
        table.boolean('is_template').defaultTo(false);
        table.boolean('is_active').defaultTo(true);
        table.string('schedule'); // Cron expression for scheduled runs
        table.timestamps(true, true);
        table.index('workspace_id');
        table.index('user_id');
        table.index('is_template');
    });

    // Dataflow run history
    await knex.schema.createTable('dataflow_runs', (table) => {
        table.increments('id').primary();
        table.integer('dataflow_id').unsigned().notNullable().references('dataflows.id').onDelete('CASCADE');
        table.integer('dataset_id').unsigned().references('datasets.id').onDelete('SET NULL');
        table.integer('user_id').unsigned().notNullable().references('users.id').onDelete('CASCADE');
        table.string('status', 50).notNullable().defaultTo('pending'); // 'pending', 'running', 'completed', 'failed'
        table.json('step_results'); // Results from each step
        table.text('error_message');
        table.timestamp('started_at');
        table.timestamp('completed_at');
        table.timestamps(true, true);
        table.index('dataflow_id');
        table.index('dataset_id');
        table.index('status');
    });

    // Reports table for saved reports
    await knex.schema.createTable('reports', (table) => {
        table.increments('id').primary();
        table.integer('workspace_id').unsigned().notNullable().references('workspaces.id').onDelete('CASCADE');
        table.integer('dataset_id').unsigned().references('datasets.id').onDelete('SET NULL');
        table.integer('user_id').unsigned().notNullable().references('users.id').onDelete('CASCADE');
        table.string('name').notNullable();
        table.string('type').defaultTo('custom'); // 'executive', 'quality', 'audit', 'comparative', 'custom'
        table.text('description');
        table.json('sections'); // Report sections configuration
        table.json('config'); // Report-wide settings
        table.boolean('is_template').defaultTo(false);
        table.timestamps(true, true);
        table.index('workspace_id');
        table.index('dataset_id');
        table.index('user_id');
        table.index('type');
    });
};

export const down = async function (knex) {
    await knex.schema.dropTableIfExists('reports');
    await knex.schema.dropTableIfExists('dataflow_runs');
    await knex.schema.dropTableIfExists('dataflows');
    await knex.schema.dropTableIfExists('recovery_scripts');
    await knex.schema.dropTableIfExists('cleaning_history');

    await knex.schema.alterTable('datasets', (table) => {
        table.dropColumn('cleaned_data');
        table.dropColumn('cleaning_confirmed');
        table.dropColumn('cleaning_summary');
        table.dropColumn('quarantined_data');
        table.dropColumn('health_score');
    });
};
