export const up = async function (knex) {
    await knex.schema.createTable('activity_log', (table) => {
        table.increments('id').primary();
        table.integer('user_id').unsigned().notNullable().references('users.id').onDelete('CASCADE');
        table.integer('workspace_id').unsigned().notNullable().references('workspaces.id').onDelete('CASCADE');
        table.integer('dataset_id').unsigned().references('datasets.id').onDelete('SET NULL');

        table.string('action_type').notNullable(); // 'edit', 'clean', 'query', 'export', 'version_create', etc.
        table.string('action_category').notNullable(); // 'data', 'system', 'report', 'dashboard'
        table.text('action_detail'); // Human readable description
        table.json('action_metadata'); // { before, after, affected_rows, etc. }

        table.string('source_component'); // 'cleaning', 'playground', 'dashboard', etc.
        table.boolean('is_undoable').defaultTo(false);
        table.json('undo_data'); // If undoable, what's needed to reverse

        table.timestamps(true, true);

        table.index(['workspace_id', 'created_at']);
        table.index(['dataset_id', 'created_at']);
        table.index('user_id');
    });
};

export const down = async function (knex) {
    await knex.schema.dropTableIfExists('activity_log');
};
