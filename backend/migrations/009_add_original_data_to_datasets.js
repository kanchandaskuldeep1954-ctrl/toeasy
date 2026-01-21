/**
 * Migration: 009_add_original_data_to_datasets
 * 
 * Adds support for:
 * - Storing the original uploaded data separately from the active/cleaned data
 * - Ensuring full auditability (Original vs Cleaned comparisons)
 */

export const up = async function (knex) {
    await knex.schema.alterTable('datasets', (table) => {
        table.json('original_data'); // Archive of the initial upload
    });

    // Populate existing rows: Copy raw_data to original_data if original_data is null
    await knex.raw('UPDATE datasets SET original_data = raw_data WHERE original_data IS NULL');
};

export const down = async function (knex) {
    await knex.schema.alterTable('datasets', (table) => {
        table.dropColumn('original_data');
    });
};
