/**
 * Migration: 008_add_validation_rules_to_datasets
 */

export const up = async function (knex) {
    await knex.schema.alterTable('datasets', (table) => {
        table.json('validation_rules');
    });
};

export const down = async function (knex) {
    await knex.schema.alterTable('datasets', (table) => {
        table.dropColumn('validation_rules');
    });
};
