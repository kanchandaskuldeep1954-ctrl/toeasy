/**
 * Migration: Create strategic_reports and report_versions tables
 * Support for advanced strategic reports with full version history
 */

export const up = async function (knex) {
    // 1. Create strategic_reports table
    await knex.schema.createTable('strategic_reports', (table) => {
        table.increments('id').primary();
        table.integer('workspace_id').unsigned().references('id').inTable('workspaces').onDelete('CASCADE');
        table.integer('dataset_id').unsigned().references('id').inTable('datasets').onDelete('SET NULL');
        table.integer('owner_id').unsigned().references('id').inTable('users');
        table.string('name', 255).notNullable();
        table.text('description');
        table.jsonb('current_content').defaultTo('{}');
        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.timestamp('updated_at').defaultTo(knex.fn.now());

        table.index(['workspace_id']);
        table.index(['dataset_id']);
    });

    // 2. Create report_versions table
    await knex.schema.createTable('report_versions', (table) => {
        table.increments('id').primary();
        table.integer('report_id').unsigned().references('id').inTable('strategic_reports').onDelete('CASCADE');
        table.integer('version_number').notNullable();
        table.jsonb('content').notNullable();
        table.integer('created_by').unsigned().references('id').inTable('users');
        table.text('change_summary');
        table.timestamp('created_at').defaultTo(knex.fn.now());

        table.index(['report_id']);
        table.index(['version_number']);
    });

    console.log('Created strategic_reports and report_versions tables');
};

export const down = async function (knex) {
    await knex.schema.dropTableIfExists('report_versions');
    await knex.schema.dropTableIfExists('strategic_reports');
    console.log('Dropped strategic_reports and report_versions tables');
};
