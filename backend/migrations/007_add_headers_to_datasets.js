export const up = async function (knex) {
    await knex.schema.alterTable('datasets', (table) => {
        table.json('headers').nullable(); // Stores the last known headers for the dataset
    });
};

export const down = async function (knex) {
    await knex.schema.alterTable('datasets', (table) => {
        table.dropColumn('headers');
    });
};
