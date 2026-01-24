export const up = async function (knex) {
    await knex.schema.createTable('integrations', (table) => {
        table.increments('id').primary();
        table.integer('user_id').unsigned().notNullable().references('users.id').onDelete('CASCADE');
        table.integer('workspace_id').unsigned().notNullable().references('workspaces.id').onDelete('CASCADE');
        table.string('provider').notNullable(); // e.g., 'postgres', 'stripe', 'salesforce'
        table.string('name').notNullable(); // User defined name for this connection
        table.json('credentials').notNullable(); // Encrypted credentials object
        table.enum('status', ['active', 'error', 'expired']).defaultTo('active');
        table.timestamp('last_sync_at');
        table.string('sync_message'); // To store error messages if sync fails
        table.timestamps(true, true);

        table.index('user_id');
        table.index('workspace_id');
        table.index(['provider', 'status']);
    });
};

export const down = async function (knex) {
    await knex.schema.dropTableIfExists('integrations');
};
