/**
 * Migration: 030_decision_os_v2.js
 * Decision OS primitives for V2:
 * - Projects + Analysis Rooms
 * - Artifacts + Lineage
 * - Comments + Decisions
 * - Automations + Approvals
 * - Metrics + User preference profiles
 */

export async function up(knex) {
  if (!(await knex.schema.hasTable('projects'))) {
    await knex.schema.createTable('projects', (table) => {
      table.increments('id').primary();
      table.integer('workspace_id').notNullable().references('id').inTable('workspaces').onDelete('CASCADE');
      table.string('name').notNullable();
      table.text('description');
      table.text('objective');
      table
        .enum('status', ['active', 'paused', 'completed', 'archived'], {
          useNative: true,
          enumName: 'project_status_enum'
        })
        .notNullable()
        .defaultTo('active');
      table.integer('created_by').references('id').inTable('users').onDelete('SET NULL');
      table.timestamps(true, true);
      table.index(['workspace_id', 'status']);
      table.index(['workspace_id', 'created_at']);
    });
  }

  if (!(await knex.schema.hasTable('analysis_rooms'))) {
    await knex.schema.createTable('analysis_rooms', (table) => {
      table.increments('id').primary();
      table.integer('workspace_id').notNullable().references('id').inTable('workspaces').onDelete('CASCADE');
      table.integer('project_id').notNullable().references('id').inTable('projects').onDelete('CASCADE');
      table.string('name').notNullable();
      table.text('description');
      table
        .enum('stage', ['ingest', 'profile', 'analyze', 'brief', 'action', 'done'], {
          useNative: true,
          enumName: 'room_stage_enum'
        })
        .notNullable()
        .defaultTo('ingest');
      table.jsonb('run_context').notNullable().defaultTo(knex.raw(`'{}'::jsonb`));
      table.boolean('is_archived').notNullable().defaultTo(false);
      table.integer('created_by').references('id').inTable('users').onDelete('SET NULL');
      table.timestamps(true, true);
      table.index(['workspace_id', 'project_id']);
      table.index(['workspace_id', 'stage']);
    });
  }

  if (!(await knex.schema.hasTable('artifacts'))) {
    await knex.schema.createTable('artifacts', (table) => {
      table.increments('id').primary();
      table.integer('workspace_id').notNullable().references('id').inTable('workspaces').onDelete('CASCADE');
      table.integer('project_id').references('id').inTable('projects').onDelete('SET NULL');
      table.integer('room_id').notNullable().references('id').inTable('analysis_rooms').onDelete('CASCADE');
      table
        .enum(
          'artifact_type',
          ['dataset_version', 'query_run', 'chart', 'pivot', 'report_block', 'decision_brief', 'action_item'],
          { useNative: true, enumName: 'artifact_type_enum' }
        )
        .notNullable();
      table.string('title').notNullable();
      table.text('description');
      table.jsonb('payload').notNullable().defaultTo(knex.raw(`'{}'::jsonb`));
      table.jsonb('metadata').notNullable().defaultTo(knex.raw(`'{}'::jsonb`));
      table.integer('dataset_version_id').references('id').inTable('dataset_versions').onDelete('SET NULL');
      table.integer('source_dataset_id').references('id').inTable('datasets').onDelete('SET NULL');
      table.integer('created_by').references('id').inTable('users').onDelete('SET NULL');
      table.timestamps(true, true);
      table.index(['workspace_id', 'room_id', 'artifact_type']);
      table.index(['workspace_id', 'room_id', 'created_at']);
    });
  }

  if (!(await knex.schema.hasTable('lineage_edges'))) {
    await knex.schema.createTable('lineage_edges', (table) => {
      table.increments('id').primary();
      table.integer('workspace_id').notNullable().references('id').inTable('workspaces').onDelete('CASCADE');
      table.integer('room_id').notNullable().references('id').inTable('analysis_rooms').onDelete('CASCADE');
      table.integer('parent_artifact_id').notNullable().references('id').inTable('artifacts').onDelete('CASCADE');
      table.integer('child_artifact_id').notNullable().references('id').inTable('artifacts').onDelete('CASCADE');
      table.string('relation_type').notNullable().defaultTo('derived_from');
      table.integer('created_by').references('id').inTable('users').onDelete('SET NULL');
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.unique(['parent_artifact_id', 'child_artifact_id', 'relation_type']);
      table.index(['workspace_id', 'room_id']);
      table.index(['child_artifact_id']);
    });
  }

  if (!(await knex.schema.hasTable('comment_threads'))) {
    await knex.schema.createTable('comment_threads', (table) => {
      table.increments('id').primary();
      table.integer('workspace_id').notNullable().references('id').inTable('workspaces').onDelete('CASCADE');
      table.integer('room_id').notNullable().references('id').inTable('analysis_rooms').onDelete('CASCADE');
      table.integer('artifact_id').references('id').inTable('artifacts').onDelete('CASCADE');
      table.jsonb('anchor').notNullable().defaultTo(knex.raw(`'{}'::jsonb`));
      table.integer('created_by').references('id').inTable('users').onDelete('SET NULL');
      table.timestamps(true, true);
      table.index(['workspace_id', 'room_id']);
      table.index(['artifact_id']);
    });
  }

  if (!(await knex.schema.hasTable('comments'))) {
    await knex.schema.createTable('comments', (table) => {
      table.increments('id').primary();
      table.integer('thread_id').notNullable().references('id').inTable('comment_threads').onDelete('CASCADE');
      table.integer('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
      table.text('content').notNullable();
      table.jsonb('mentions').notNullable().defaultTo(knex.raw(`'[]'::jsonb`));
      table.timestamps(true, true);
      table.index(['thread_id', 'created_at']);
    });
  }

  if (!(await knex.schema.hasTable('decision_records'))) {
    await knex.schema.createTable('decision_records', (table) => {
      table.increments('id').primary();
      table.integer('workspace_id').notNullable().references('id').inTable('workspaces').onDelete('CASCADE');
      table.integer('room_id').notNullable().references('id').inTable('analysis_rooms').onDelete('CASCADE');
      table.integer('artifact_id').references('id').inTable('artifacts').onDelete('SET NULL');
      table.string('decision').notNullable();
      table.text('rationale');
      table
        .enum('status', ['pending', 'approved', 'rejected'], {
          useNative: true,
          enumName: 'decision_status_enum'
        })
        .notNullable()
        .defaultTo('pending');
      table.integer('created_by').references('id').inTable('users').onDelete('SET NULL');
      table.integer('decided_by').references('id').inTable('users').onDelete('SET NULL');
      table.timestamp('decided_at');
      table.timestamps(true, true);
      table.index(['workspace_id', 'room_id', 'status']);
    });
  }

  if (!(await knex.schema.hasTable('automation_policies'))) {
    await knex.schema.createTable('automation_policies', (table) => {
      table.increments('id').primary();
      table.integer('workspace_id').notNullable().references('id').inTable('workspaces').onDelete('CASCADE');
      table.integer('room_id').references('id').inTable('analysis_rooms').onDelete('SET NULL');
      table.string('name').notNullable();
      table.text('description');
      table
        .enum('risk_level', ['low', 'medium', 'high'], {
          useNative: true,
          enumName: 'automation_risk_enum'
        })
        .notNullable()
        .defaultTo('medium');
      table.string('trigger_type').notNullable();
      table.jsonb('trigger_config').notNullable().defaultTo(knex.raw(`'{}'::jsonb`));
      table.string('action_type').notNullable();
      table.jsonb('action_config').notNullable().defaultTo(knex.raw(`'{}'::jsonb`));
      table.boolean('is_active').notNullable().defaultTo(true);
      table.integer('created_by').references('id').inTable('users').onDelete('SET NULL');
      table.timestamps(true, true);
      table.index(['workspace_id', 'is_active']);
      table.index(['workspace_id', 'room_id']);
    });
  }

  if (!(await knex.schema.hasTable('automation_runs'))) {
    await knex.schema.createTable('automation_runs', (table) => {
      table.increments('id').primary();
      table.integer('workspace_id').notNullable().references('id').inTable('workspaces').onDelete('CASCADE');
      table.integer('room_id').references('id').inTable('analysis_rooms').onDelete('SET NULL');
      table.integer('automation_policy_id').notNullable().references('id').inTable('automation_policies').onDelete('CASCADE');
      table
        .enum('status', ['queued', 'running', 'awaiting_approval', 'completed', 'failed'], {
          useNative: true,
          enumName: 'automation_run_status_enum'
        })
        .notNullable()
        .defaultTo('queued');
      table
        .enum('risk_level', ['low', 'medium', 'high'], {
          useNative: true,
          enumName: 'automation_run_risk_enum'
        })
        .notNullable()
        .defaultTo('medium');
      table.jsonb('input').notNullable().defaultTo(knex.raw(`'{}'::jsonb`));
      table.jsonb('output').notNullable().defaultTo(knex.raw(`'{}'::jsonb`));
      table.text('error');
      table.timestamp('started_at');
      table.timestamp('completed_at');
      table.integer('created_by').references('id').inTable('users').onDelete('SET NULL');
      table.timestamps(true, true);
      table.index(['workspace_id', 'status']);
      table.index(['automation_policy_id', 'created_at']);
    });
  }

  if (!(await knex.schema.hasTable('approval_requests'))) {
    await knex.schema.createTable('approval_requests', (table) => {
      table.increments('id').primary();
      table.integer('workspace_id').notNullable().references('id').inTable('workspaces').onDelete('CASCADE');
      table.integer('room_id').references('id').inTable('analysis_rooms').onDelete('SET NULL');
      table.integer('automation_run_id').references('id').inTable('automation_runs').onDelete('SET NULL');
      table.integer('requested_by').notNullable().references('id').inTable('users').onDelete('CASCADE');
      table.integer('approver_id').references('id').inTable('users').onDelete('SET NULL');
      table
        .enum('risk_level', ['low', 'medium', 'high'], {
          useNative: true,
          enumName: 'approval_risk_enum'
        })
        .notNullable()
        .defaultTo('medium');
      table
        .enum('status', ['pending', 'approved', 'rejected'], {
          useNative: true,
          enumName: 'approval_status_enum'
        })
        .notNullable()
        .defaultTo('pending');
      table.text('reason');
      table.text('response_note');
      table.integer('responded_by').references('id').inTable('users').onDelete('SET NULL');
      table.timestamp('responded_at');
      table.timestamps(true, true);
      table.index(['workspace_id', 'status']);
      table.index(['automation_run_id']);
    });
  }

  if (!(await knex.schema.hasTable('metric_definitions'))) {
    await knex.schema.createTable('metric_definitions', (table) => {
      table.increments('id').primary();
      table.integer('workspace_id').notNullable().references('id').inTable('workspaces').onDelete('CASCADE');
      table.string('name').notNullable();
      table.string('metric_key').notNullable();
      table.text('description');
      table.text('formula');
      table.integer('owner_id').references('id').inTable('users').onDelete('SET NULL');
      table.timestamps(true, true);
      table.unique(['workspace_id', 'metric_key']);
      table.index(['workspace_id', 'created_at']);
    });
  }

  if (!(await knex.schema.hasTable('metric_value_snapshots'))) {
    await knex.schema.createTable('metric_value_snapshots', (table) => {
      table.increments('id').primary();
      table.integer('workspace_id').notNullable().references('id').inTable('workspaces').onDelete('CASCADE');
      table.integer('metric_definition_id').notNullable().references('id').inTable('metric_definitions').onDelete('CASCADE');
      table.integer('room_id').references('id').inTable('analysis_rooms').onDelete('SET NULL');
      table.decimal('value', 20, 6).notNullable();
      table.timestamp('observed_at').notNullable().defaultTo(knex.fn.now());
      table.integer('evidence_artifact_id').references('id').inTable('artifacts').onDelete('SET NULL');
      table.jsonb('metadata').notNullable().defaultTo(knex.raw(`'{}'::jsonb`));
      table.timestamps(true, true);
      table.index(['metric_definition_id', 'observed_at']);
      table.index(['workspace_id', 'observed_at']);
    });
  }

  if (!(await knex.schema.hasTable('user_preference_profiles'))) {
    await knex.schema.createTable('user_preference_profiles', (table) => {
      table.increments('id').primary();
      table.integer('workspace_id').references('id').inTable('workspaces').onDelete('CASCADE');
      table.integer('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
      table
        .enum('persona', ['analyst', 'manager', 'executive'], {
          useNative: true,
          enumName: 'persona_enum'
        })
        .notNullable()
        .defaultTo('analyst');
      table
        .enum('ui_mode', ['guided', 'expert'], {
          useNative: true,
          enumName: 'ui_mode_enum'
        })
        .notNullable()
        .defaultTo('guided');
      table.string('report_style').notNullable().defaultTo('concise');
      table.string('ai_style').notNullable().defaultTo('tactical');
      table.jsonb('notification_preferences').notNullable().defaultTo(knex.raw(`'{}'::jsonb`));
      table.jsonb('panel_preferences').notNullable().defaultTo(knex.raw(`'{}'::jsonb`));
      table.timestamps(true, true);
      table.unique(['workspace_id', 'user_id']);
      table.index(['user_id', 'workspace_id']);
    });
  }
}

export async function down(knex) {
  await knex.schema.dropTableIfExists('user_preference_profiles');
  await knex.schema.dropTableIfExists('metric_value_snapshots');
  await knex.schema.dropTableIfExists('metric_definitions');
  await knex.schema.dropTableIfExists('approval_requests');
  await knex.schema.dropTableIfExists('automation_runs');
  await knex.schema.dropTableIfExists('automation_policies');
  await knex.schema.dropTableIfExists('decision_records');
  await knex.schema.dropTableIfExists('comments');
  await knex.schema.dropTableIfExists('comment_threads');
  await knex.schema.dropTableIfExists('lineage_edges');
  await knex.schema.dropTableIfExists('artifacts');
  await knex.schema.dropTableIfExists('analysis_rooms');
  await knex.schema.dropTableIfExists('projects');
}
