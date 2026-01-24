export const up = async function (knex) {
    const hasName = await knex.schema.hasColumn('users', 'name');
    const hasFullName = await knex.schema.hasColumn('users', 'full_name');

    if (hasName && !hasFullName) {
        await knex.schema.alterTable('users', (table) => {
            table.renameColumn('name', 'full_name');
        });
    } else if (hasName && hasFullName) {
        // Both exist, maybe drop 'name' or migrate data? 
        // For safety, assuming 'full_name' is the target, we just drop 'name' if data migration isn't needed or already done.
        // But simpler: just drop 'name' if we are cleaning up. 
        // HOWEVER, safer: do nothing if full_name is there.
        // Actually, if both exist, we might want to ensure older logic didn't leave 'name'.
        // Let's just focus on the reported error: 'name' does NOT exist.
    }
};

export const down = async function (knex) {
    const hasFullName = await knex.schema.hasColumn('users', 'full_name');
    if (hasFullName) {
        await knex.schema.alterTable('users', (table) => {
            table.renameColumn('full_name', 'name');
        });
    }
};
