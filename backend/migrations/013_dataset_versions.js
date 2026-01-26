export const up = async function (knex) {
    // Dataset Versions table
    await knex.schema.createTable('dataset_versions', (table) => {
        table.increments('id').primary();
        table.integer('dataset_id').unsigned().notNullable().references('datasets.id').onDelete('CASCADE');
        table.integer('created_by_user_id').unsigned().notNullable().references('users.id').onDelete('CASCADE');

        table.string('version_name').notNullable(); // e.g., "Cleaned v1", "Raw Import"
        table.text('description'); // User provided or auto-generated

        // Core Data
        table.json('data').notNullable(); // The actual data version
        table.json('headers'); // Headers snapshot
        table.integer('row_count');

        // Lineage
        table.integer('parent_version_id').unsigned().references('dataset_versions.id').onDelete('SET NULL');
        table.string('created_by_tool'); // 'playground', 'cleaning', 'dataflow', 'upload'
        table.text('transformation_script'); // Audit: Code or rules used to create this

        table.timestamps(true, true);

        table.index('dataset_id');
        table.index('created_by_user_id');
    });

    // Backfill: Create initial "v1" for existing datasets
    // We can't easily do this in migration without raw SQL, so we'll skip complex backfill logic here
    // and rely on the application to handle legacy datasets gracefully (treated as v1)
};

export const down = async function (knex) {
    await knex.schema.dropTableIfExists('dataset_versions');
};
