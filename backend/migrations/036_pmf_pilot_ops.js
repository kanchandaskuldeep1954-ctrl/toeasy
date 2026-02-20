export async function up(knex) {
  if (!(await knex.schema.hasTable('reliability_incidents'))) {
    await knex.schema.createTable('reliability_incidents', (table) => {
      table.increments('id').primary();
      table.integer('workspace_id').notNullable().references('id').inTable('workspaces').onDelete('CASCADE');
      table.integer('room_id').references('id').inTable('analysis_rooms').onDelete('SET NULL');
      table.string('source_type').notNullable();
      table.string('source_key').notNullable();
      table.string('code').notNullable();
      table
        .enu('severity', ['critical', 'high', 'medium', 'low'], {
          useNative: true,
          enumName: 'incident_severity'
        })
        .notNullable()
        .defaultTo('high');
      table
        .enu('status', ['open', 'acknowledged', 'resolved'], {
          useNative: true,
          enumName: 'incident_status'
        })
        .notNullable()
        .defaultTo('open');
      table.integer('owner_id').references('id').inTable('users').onDelete('SET NULL');
      table.timestamp('opened_at').notNullable().defaultTo(knex.fn.now());
      table.timestamp('acknowledged_at');
      table.timestamp('resolved_at');
      table.timestamp('sla_due_at');
      table.text('runbook_action');
      table.text('resolution_note');
      table.jsonb('metadata').notNullable().defaultTo(knex.raw(`'{}'::jsonb`));
      table.timestamps(true, true);

      table.unique(['workspace_id', 'source_key']);
      table.index(['workspace_id', 'status', 'severity', 'sla_due_at'], 'reliability_incidents_status_idx');
      table.index(['workspace_id', 'room_id', 'status'], 'reliability_incidents_room_status_idx');
      table.index(['workspace_id', 'opened_at'], 'reliability_incidents_opened_idx');
    });
  }

  if (!(await knex.schema.hasTable('pilot_weekly_snapshots'))) {
    await knex.schema.createTable('pilot_weekly_snapshots', (table) => {
      table.increments('id').primary();
      table.integer('workspace_id').notNullable().references('id').inTable('workspaces').onDelete('CASCADE');
      table.date('week_start').notNullable();
      table.integer('room_id').references('id').inTable('analysis_rooms').onDelete('SET NULL');
      table.integer('period_days').notNullable().defaultTo(7);
      table.jsonb('scorecard_json').notNullable().defaultTo(knex.raw(`'{}'::jsonb`));
      table.jsonb('readiness_json').notNullable().defaultTo(knex.raw(`'{}'::jsonb`));
      table.integer('created_by').references('id').inTable('users').onDelete('SET NULL');
      table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());

      table.index(['workspace_id', 'week_start'], 'pilot_weekly_snapshots_workspace_week_idx');
      table.index(['workspace_id', 'room_id', 'week_start'], 'pilot_weekly_snapshots_room_week_idx');
    });
  }
}

export async function down(knex) {
  await knex.schema.dropTableIfExists('pilot_weekly_snapshots');
  await knex.schema.dropTableIfExists('reliability_incidents');

  await knex.raw('DROP TYPE IF EXISTS incident_status');
  await knex.raw('DROP TYPE IF EXISTS incident_severity');
}
