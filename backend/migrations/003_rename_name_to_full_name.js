export const up = async function (knex) {
    await knex.schema.alterTable('users', (table) => {
        table.renameColumn('name', 'full_name');
    });
};

export const down = async function (knex) {
    await knex.schema.alterTable('users', (table) => {
        table.renameColumn('full_name', 'name');
    });
};
