/**
 * Migration: 006_add_description_to_datasets
 * 
 * Adds description column to datasets table for storing metadata notes
 */

export const up = async function (knex) {
    await knex.schema.alterTable('datasets', (table) => {
        table.text('description'); // Add description column
    });
};

export const down = async function (knex) {
    await knex.schema.alterTable('datasets', (table) => {
        table.dropColumn('description');
    });
};
