export async function up(knex) {
  if (!(await knex.schema.hasTable('dataset_profiles'))) {
    await knex.schema.createTable('dataset_profiles', (table) => {
      table.increments('id').primary();
      table.integer('workspace_id').notNullable().references('id').inTable('workspaces').onDelete('CASCADE');
      table.integer('room_id').notNullable().references('id').inTable('analysis_rooms').onDelete('CASCADE');
      table.integer('dataset_id').references('id').inTable('datasets').onDelete('SET NULL');
      table.integer('dataset_version_id').references('id').inTable('dataset_versions').onDelete('SET NULL');
      table.integer('artifact_id').references('id').inTable('artifacts').onDelete('SET NULL');
      table.decimal('quality_score', 8, 5).notNullable().defaultTo(0);
      table.jsonb('missingness').notNullable().defaultTo(knex.raw(`'[]'::jsonb`));
      table.jsonb('duplicate_keys').notNullable().defaultTo(knex.raw(`'[]'::jsonb`));
      table.jsonb('date_continuity').notNullable().defaultTo(knex.raw(`'[]'::jsonb`));
      table.jsonb('invalid_numerics').notNullable().defaultTo(knex.raw(`'[]'::jsonb`));
      table.integer('row_count').notNullable().defaultTo(0);
      table.integer('column_count').notNullable().defaultTo(0);
      table.jsonb('summary').notNullable().defaultTo(knex.raw(`'{}'::jsonb`));
      table.integer('created_by').references('id').inTable('users').onDelete('SET NULL');
      table.timestamps(true, true);

      table.index(['workspace_id', 'room_id', 'created_at']);
      table.index(['workspace_id', 'dataset_version_id']);
      table.index(['workspace_id', 'dataset_id']);
    });
  }

  if (!(await knex.schema.hasTable('query_versions'))) {
    await knex.schema.createTable('query_versions', (table) => {
      table.increments('id').primary();
      table.integer('workspace_id').notNullable().references('id').inTable('workspaces').onDelete('CASCADE');
      table.integer('room_id').notNullable().references('id').inTable('analysis_rooms').onDelete('CASCADE');
      table.integer('query_id').references('id').inTable('queries').onDelete('SET NULL');
      table.integer('version_number').notNullable().defaultTo(1);
      table.text('sql_template').notNullable();
      table.jsonb('parameters_schema').notNullable().defaultTo(knex.raw(`'{}'::jsonb`));
      table.jsonb('metadata').notNullable().defaultTo(knex.raw(`'{}'::jsonb`));
      table.integer('created_by').references('id').inTable('users').onDelete('SET NULL');
      table.timestamps(true, true);

      table.index(['workspace_id', 'room_id', 'created_at']);
      table.index(['workspace_id', 'query_id', 'version_number']);
    });
  }

  if (!(await knex.schema.hasTable('visual_annotations'))) {
    await knex.schema.createTable('visual_annotations', (table) => {
      table.increments('id').primary();
      table.integer('workspace_id').notNullable().references('id').inTable('workspaces').onDelete('CASCADE');
      table.integer('room_id').notNullable().references('id').inTable('analysis_rooms').onDelete('CASCADE');
      table.integer('visual_id').notNullable().references('id').inTable('visual_specs').onDelete('CASCADE');
      table.integer('artifact_id').references('id').inTable('artifacts').onDelete('SET NULL');
      table.text('text').notNullable();
      table.jsonb('anchor').notNullable().defaultTo(knex.raw(`'{}'::jsonb`));
      table.integer('created_by').references('id').inTable('users').onDelete('SET NULL');
      table.timestamps(true, true);

      table.index(['workspace_id', 'room_id', 'created_at']);
      table.index(['visual_id', 'created_at']);
    });
  }

  if (!(await knex.schema.hasTable('review_submissions'))) {
    await knex.schema.createTable('review_submissions', (table) => {
      table.increments('id').primary();
      table.integer('workspace_id').notNullable().references('id').inTable('workspaces').onDelete('CASCADE');
      table.integer('room_id').notNullable().references('id').inTable('analysis_rooms').onDelete('CASCADE');
      table.string('bundle_id').notNullable();
      table.string('stage').notNullable().defaultTo('manager_review');
      table
        .enum('status', ['pending', 'approved', 'rejected', 'cancelled'], {
          useNative: true,
          enumName: 'review_submission_status_enum'
        })
        .notNullable()
        .defaultTo('pending');
      table.integer('submitted_by').references('id').inTable('users').onDelete('SET NULL');
      table.integer('reviewer_id').references('id').inTable('users').onDelete('SET NULL');
      table.text('note');
      table.text('response_note');
      table.integer('responded_by').references('id').inTable('users').onDelete('SET NULL');
      table.timestamp('responded_at');
      table.timestamps(true, true);

      table.index(['workspace_id', 'room_id', 'status']);
      table.index(['workspace_id', 'bundle_id', 'created_at']);
    });
  }

  if (!(await knex.schema.hasTable('idempotency_keys'))) {
    await knex.schema.createTable('idempotency_keys', (table) => {
      table.increments('id').primary();
      table.integer('workspace_id').notNullable().references('id').inTable('workspaces').onDelete('CASCADE');
      table.integer('room_id').references('id').inTable('analysis_rooms').onDelete('SET NULL');
      table.string('endpoint_key').notNullable();
      table.string('idempotency_key').notNullable();
      table.integer('created_by').references('id').inTable('users').onDelete('SET NULL');
      table.integer('status_code');
      table.jsonb('response_payload').notNullable().defaultTo(knex.raw(`'{}'::jsonb`));
      table.timestamp('completed_at');
      table.timestamps(true, true);
      table.unique(['workspace_id', 'room_id', 'endpoint_key', 'idempotency_key']);
      table.index(['workspace_id', 'endpoint_key', 'idempotency_key']);
      table.index(['workspace_id', 'room_id', 'created_at']);
    });
  }
}

export async function down(knex) {
  await knex.schema.dropTableIfExists('idempotency_keys');
  await knex.schema.dropTableIfExists('review_submissions');
  await knex.schema.dropTableIfExists('visual_annotations');
  await knex.schema.dropTableIfExists('query_versions');
  await knex.schema.dropTableIfExists('dataset_profiles');
}
