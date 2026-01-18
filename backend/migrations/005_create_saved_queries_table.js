export const up = async function (knex) {
    // Add is_saved column to queries table
    await knex.schema.alterTable('queries', (table) => {
        table.boolean('is_saved').defaultTo(false);
    });
};

export const down = async function (knex) {
    await knex.schema.alterTable('queries', (table) => {
        table.dropColumn('is_saved');
    });
};
