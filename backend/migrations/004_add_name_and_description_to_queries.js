export const up = async function (knex) {
    // Add name and description columns to queries table
    await knex.schema.alterTable('queries', (table) => {
        table.string('name');
        table.text('description');
    });
};

export const down = async function (knex) {
    await knex.schema.alterTable('queries', (table) => {
        table.dropColumn('name');
        table.dropColumn('description');
    });
};
