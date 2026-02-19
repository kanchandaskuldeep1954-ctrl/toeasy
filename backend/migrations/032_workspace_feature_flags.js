export async function up(knex) {
  if (!(await knex.schema.hasTable('workspace_feature_flags'))) {
    await knex.schema.createTable('workspace_feature_flags', (table) => {
      table.increments('id').primary();
      table.integer('workspace_id').notNullable().references('id').inTable('workspaces').onDelete('CASCADE');
      table.string('flag_key').notNullable();
      table.boolean('is_enabled').notNullable().defaultTo(true);
      table.integer('updated_by').references('id').inTable('users').onDelete('SET NULL');
      table.timestamps(true, true);

      table.unique(['workspace_id', 'flag_key']);
      table.index(['workspace_id', 'flag_key']);
    });
  }

  const workspaces = await knex('workspaces').select('id');
  for (const workspace of workspaces) {
    await knex('workspace_feature_flags')
      .insert({
        workspace_id: workspace.id,
        flag_key: 'report_v2_enabled',
        is_enabled: true
      })
      .onConflict(['workspace_id', 'flag_key'])
      .ignore();
  }
}

export async function down(knex) {
  await knex.schema.dropTableIfExists('workspace_feature_flags');
}

