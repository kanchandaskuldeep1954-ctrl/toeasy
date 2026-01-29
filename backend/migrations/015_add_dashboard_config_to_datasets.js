/**
 * Migration: 015_add_dashboard_config_to_datasets
 * 
 * Adds support for storing Master dashboard configurations and AI reports 
 * directly on the dataset entity.
 */

export const up = async function (knex) {
    await knex.schema.alterTable('datasets', (table) => {
        table.json('dashboard_config'); // Stores the default dashboard layout/configs
        table.json('strategic_report'); // Stores the AI-generated strategic report
    });
};

export const down = async function (knex) {
    await knex.schema.alterTable('datasets', (table) => {
        table.dropColumn('dashboard_config');
        table.dropColumn('strategic_report');
    });
};
