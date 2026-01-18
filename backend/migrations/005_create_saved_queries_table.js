export const up = async function (knex) {
    // Create saved_queries table
    await knex.schema.createTable('saved_queries', (table) => {
        table.increments('id').primary();
        table.integer('workspace_id').unsigned().notNullable().references('workspaces.id').onDelete('CASCADE');
        table.integer('dataset_id').unsigned().notNullable().references('datasets.id').onDelete('CASCADE');
        table.integer('user_id').unsigned().notNullable().references('users.id').onDelete('CASCADE');
        table.string('name').notNullable();
        table.text('description');
        table.text('query_text').notNullable();
        table.enum('query_type', ['sql', 'natural']).defaultTo('sql');
        table.integer('result_count').defaultTo(0);
        table.timestamps(true, true);
        table.index('workspace_id');
        table.index('dataset_id');
        table.index('user_id');
    });
};

export const down = async function (knex) {
    await knex.schema.dropTableIfExists('saved_queries');
};
