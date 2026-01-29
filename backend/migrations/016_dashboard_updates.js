export const up = async function (knex) {
    // 1. Update dashboards table
    await knex.schema.alterTable('dashboards', (table) => {
        table.integer('dataset_id').unsigned().references('datasets.id').onDelete('CASCADE');
        table.boolean('is_primary').defaultTo(false);
    });

    // 2. Create dashboard_versions table
    await knex.schema.createTable('dashboard_versions', (table) => {
        table.increments('id').primary();
        table.integer('dashboard_id').unsigned().notNullable().references('dashboards.id').onDelete('CASCADE');
        table.string('version_name').notNullable();
        table.text('description');
        table.jsonb('config').notNullable(); // Snapshot of the layout/config
        table.timestamp('created_at').defaultTo(knex.fn.now());

        table.index('dashboard_id');
    });

    // 3. Backfill: For each dataset that has a dashboard_config, create a primary dashboard entry
    // This is safer than just relying on the JSON column in datasets
    const datasetsWithConfig = await knex('datasets').whereNotNull('dashboard_config');

    for (const ds of datasetsWithConfig) {
        let config = ds.dashboard_config;
        if (typeof config === 'string') {
            try { config = JSON.parse(config); } catch (e) { config = {}; }
        }

        await knex('dashboards').insert({
            workspace_id: ds.workspace_id,
            dataset_id: ds.id,
            name: config?.name || ds.name + ' Master',
            description: config?.description || 'Main intelligence session for this dataset',
            is_primary: true,
            layout: JSON.stringify(config)
        });
    }
};

export const down = async function (knex) {
    await knex.schema.dropTableIfExists('dashboard_versions');
    await knex.schema.alterTable('dashboards', (table) => {
        table.dropColumn('is_primary');
        table.dropColumn('dataset_id');
    });
};
