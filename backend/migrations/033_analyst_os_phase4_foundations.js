export async function up(knex) {
  if (!(await knex.schema.hasTable('metric_definition_tests'))) {
    await knex.schema.createTable('metric_definition_tests', (table) => {
      table.increments('id').primary();
      table.integer('workspace_id').notNullable().references('id').inTable('workspaces').onDelete('CASCADE');
      table.integer('metric_definition_id').notNullable().references('id').inTable('metric_definitions').onDelete('CASCADE');
      table.string('test_name').notNullable().defaultTo('schema_validation');
      table.jsonb('test_definition').notNullable().defaultTo(knex.raw(`'{}'::jsonb`));
      table.string('status').notNullable().defaultTo('pending');
      table.jsonb('last_result').notNullable().defaultTo(knex.raw(`'{}'::jsonb`));
      table.timestamp('last_run_at');
      table.integer('created_by').references('id').inTable('users').onDelete('SET NULL');
      table.timestamps(true, true);

      table.index(['workspace_id', 'metric_definition_id']);
      table.index(['workspace_id', 'status']);
      table.index(['metric_definition_id', 'last_run_at']);
    });
  }

  if (!(await knex.schema.hasTable('visual_specs'))) {
    await knex.schema.createTable('visual_specs', (table) => {
      table.increments('id').primary();
      table.integer('workspace_id').notNullable().references('id').inTable('workspaces').onDelete('CASCADE');
      table.integer('room_id').notNullable().references('id').inTable('analysis_rooms').onDelete('CASCADE');
      table.integer('artifact_id').references('id').inTable('artifacts').onDelete('SET NULL');
      table.string('name').notNullable();
      table.jsonb('spec').notNullable().defaultTo(knex.raw(`'{}'::jsonb`));
      table.jsonb('annotations').notNullable().defaultTo(knex.raw(`'[]'::jsonb`));
      table.integer('created_by').references('id').inTable('users').onDelete('SET NULL');
      table.timestamps(true, true);

      table.index(['workspace_id', 'room_id']);
      table.index(['artifact_id']);
      table.index(['room_id', 'created_at']);
    });
  }

  if (!(await knex.schema.hasTable('automation_schedules'))) {
    await knex.schema.createTable('automation_schedules', (table) => {
      table.increments('id').primary();
      table.integer('workspace_id').notNullable().references('id').inTable('workspaces').onDelete('CASCADE');
      table.integer('room_id').references('id').inTable('analysis_rooms').onDelete('SET NULL');
      table.integer('automation_policy_id').notNullable().references('id').inTable('automation_policies').onDelete('CASCADE');
      table.string('cron').notNullable();
      table.string('timezone').notNullable().defaultTo('UTC');
      table.string('dedupe_key');
      table.jsonb('retry_policy').notNullable().defaultTo(knex.raw(`'{"maxAttempts":3,"backoffMs":300}'::jsonb`));
      table.boolean('is_active').notNullable().defaultTo(true);
      table.timestamp('next_run_at');
      table.timestamp('last_run_at');
      table.integer('created_by').references('id').inTable('users').onDelete('SET NULL');
      table.timestamps(true, true);

      table.index(['workspace_id', 'is_active']);
      table.index(['room_id', 'next_run_at']);
      table.unique(['workspace_id', 'dedupe_key']);
    });
  }

  if (!(await knex.schema.hasTable('automation_run_events'))) {
    await knex.schema.createTable('automation_run_events', (table) => {
      table.increments('id').primary();
      table.integer('workspace_id').notNullable().references('id').inTable('workspaces').onDelete('CASCADE');
      table.integer('room_id').references('id').inTable('analysis_rooms').onDelete('SET NULL');
      table.integer('automation_run_id').notNullable().references('id').inTable('automation_runs').onDelete('CASCADE');
      table.string('event_type').notNullable();
      table.string('status').notNullable().defaultTo('info');
      table.integer('attempt').notNullable().defaultTo(1);
      table.text('error');
      table.jsonb('metadata').notNullable().defaultTo(knex.raw(`'{}'::jsonb`));
      table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());

      table.index(['automation_run_id', 'created_at']);
      table.index(['workspace_id', 'room_id']);
    });
  }

  if (!(await knex.schema.hasTable('room_outcome_attributions'))) {
    await knex.schema.createTable('room_outcome_attributions', (table) => {
      table.increments('id').primary();
      table.integer('workspace_id').notNullable().references('id').inTable('workspaces').onDelete('CASCADE');
      table.integer('room_id').notNullable().references('id').inTable('analysis_rooms').onDelete('CASCADE');
      table.integer('action_artifact_id').references('id').inTable('artifacts').onDelete('SET NULL');
      table.string('metric_key').notNullable();
      table.decimal('baseline_value', 20, 6);
      table.decimal('latest_value', 20, 6);
      table.decimal('delta_pct', 10, 4);
      table.string('confidence').notNullable().defaultTo('medium');
      table.jsonb('evidence_artifact_ids').notNullable().defaultTo(knex.raw(`'[]'::jsonb`));
      table.timestamp('observed_at').notNullable().defaultTo(knex.fn.now());
      table.integer('created_by').references('id').inTable('users').onDelete('SET NULL');
      table.timestamps(true, true);

      table.index(['workspace_id', 'room_id', 'metric_key']);
      table.index(['action_artifact_id']);
      table.index(['room_id', 'observed_at']);
    });
  }

  if (!(await knex.schema.hasTable('comment_thread_resolutions'))) {
    await knex.schema.createTable('comment_thread_resolutions', (table) => {
      table.increments('id').primary();
      table.integer('workspace_id').notNullable().references('id').inTable('workspaces').onDelete('CASCADE');
      table.integer('room_id').notNullable().references('id').inTable('analysis_rooms').onDelete('CASCADE');
      table.integer('thread_id').notNullable().references('id').inTable('comment_threads').onDelete('CASCADE');
      table.string('status').notNullable().defaultTo('resolved');
      table.integer('resolved_by').references('id').inTable('users').onDelete('SET NULL');
      table.text('resolution_note');
      table.timestamp('resolved_at').notNullable().defaultTo(knex.fn.now());
      table.timestamps(true, true);

      table.index(['thread_id', 'resolved_at']);
      table.index(['workspace_id', 'room_id']);
    });
  }

  if (await knex.schema.hasTable('workspace_feature_flags')) {
    const workspaces = await knex('workspaces').select('id');
    const phase4Flags = [
      'analyst_os_enabled',
      'semantic_metrics_enabled',
      'advanced_visuals_enabled',
      'automation_center_enabled',
      'outcome_attribution_enabled'
    ];
    for (const workspace of workspaces) {
      for (const flagKey of phase4Flags) {
        await knex('workspace_feature_flags')
          .insert({
            workspace_id: workspace.id,
            flag_key: flagKey,
            is_enabled: true
          })
          .onConflict(['workspace_id', 'flag_key'])
          .ignore();
      }
    }
  }
}

export async function down(knex) {
  await knex.schema.dropTableIfExists('comment_thread_resolutions');
  await knex.schema.dropTableIfExists('room_outcome_attributions');
  await knex.schema.dropTableIfExists('automation_run_events');
  await knex.schema.dropTableIfExists('automation_schedules');
  await knex.schema.dropTableIfExists('visual_specs');
  await knex.schema.dropTableIfExists('metric_definition_tests');
}
