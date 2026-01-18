export const up = async function (knex) {
    // Check if column exists first before adding
    const hasColumn = await knex.schema.hasColumn('queries', 'is_saved');
    if (!hasColumn) {
        await knex.schema.alterTable('queries', (table) => {
            table.boolean('is_saved').defaultTo(false);
        });
    }
};

export const down = async function (knex) {
    const hasColumn = await knex.schema.hasColumn('queries', 'is_saved');
    if (hasColumn) {
        await knex.schema.alterTable('queries', (table) => {
            table.dropColumn('is_saved');
        });
    }
};
