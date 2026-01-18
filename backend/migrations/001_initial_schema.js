export const up = async function (knex) {
  // Users table
  await knex.schema.createTable('users', (table) => {
    table.increments('id').primary();
    table.string('email').unique().notNullable();
    table.string('password_hash').notNullable();
    table.string('full_name');
    table.string('avatar_url');
    table.timestamps(true, true);
    table.index('email');
  });

  // Subscriptions table
  await knex.schema.createTable('subscriptions', (table) => {
    table.increments('id').primary();
    table.integer('user_id').unsigned().notNullable().references('users.id').onDelete('CASCADE');
    table.enum('tier', ['basic', 'pro', 'enterprise']).defaultTo('basic');
    table.enum('status', ['active', 'cancelled', 'expired']).defaultTo('active');
    table.timestamp('current_period_start').defaultTo(knex.fn.now());
    table.timestamp('current_period_end');
    table.timestamp('renewal_date');
    table.timestamps(true, true);
    table.index('user_id');
    table.index('status');
  });

  // Workspaces table
  await knex.schema.createTable('workspaces', (table) => {
    table.increments('id').primary();
    table.integer('user_id').unsigned().notNullable().references('users.id').onDelete('CASCADE');
    table.string('name').notNullable();
    table.text('description');
    table.boolean('is_archived').defaultTo(false);
    table.timestamps(true, true);
    table.index('user_id');
  });

  // Datasets table
  await knex.schema.createTable('datasets', (table) => {
    table.increments('id').primary();
    table.integer('workspace_id').unsigned().notNullable().references('workspaces.id').onDelete('CASCADE');
    table.integer('user_id').unsigned().notNullable().references('users.id').onDelete('CASCADE');
    table.string('name').notNullable();
    table.string('file_name');
    table.integer('row_count').defaultTo(0);
    table.integer('column_count').defaultTo(0);
    table.bigInteger('file_size').defaultTo(0);
    table.json('raw_data');
    table.json('analysis_result');
    table.timestamps(true, true);
    table.index('workspace_id');
    table.index('user_id');
  });

  // Dashboards table
  await knex.schema.createTable('dashboards', (table) => {
    table.increments('id').primary();
    table.integer('workspace_id').unsigned().notNullable().references('workspaces.id').onDelete('CASCADE');
    table.string('name').notNullable();
    table.text('description');
    table.json('layout').defaultTo('[]');
    table.timestamps(true, true);
    table.index('workspace_id');
  });

  // Queries table
  await knex.schema.createTable('queries', (table) => {
    table.increments('id').primary();
    table.integer('workspace_id').unsigned().notNullable().references('workspaces.id').onDelete('CASCADE');
    table.integer('dataset_id').unsigned().notNullable().references('datasets.id').onDelete('CASCADE');
    table.integer('executed_by').unsigned().notNullable().references('users.id').onDelete('CASCADE');
    table.text('query_text').notNullable();
    table.enum('query_type', ['sql', 'natural']).defaultTo('sql');
    table.integer('result_count').defaultTo(0);
    table.timestamps(true, true);
    table.index('dataset_id');
    table.index('executed_by');
  });

  // Validation Rules table
  await knex.schema.createTable('validation_rules', (table) => {
    table.increments('id').primary();
    table.integer('dataset_id').unsigned().notNullable().references('datasets.id').onDelete('CASCADE');
    table.string('name').notNullable();
    table.string('rule_type').notNullable();
    table.json('rule_definition');
    table.boolean('is_active').defaultTo(true);
    table.timestamps(true, true);
    table.index('dataset_id');
  });

  // Activity Logs table
  await knex.schema.createTable('activity_logs', (table) => {
    table.increments('id').primary();
    table.integer('user_id').unsigned().notNullable().references('users.id').onDelete('CASCADE');
    table.integer('workspace_id').unsigned().references('workspaces.id').onDelete('SET NULL');
    table.string('action').notNullable();
    table.string('resource_type');
    table.integer('resource_id');
    table.text('details');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.index('user_id');
    table.index('workspace_id');
  });

  // Payment Orders table
  await knex.schema.createTable('payment_orders', (table) => {
    table.increments('id').primary();
    table.integer('user_id').unsigned().notNullable().references('users.id').onDelete('CASCADE');
    table.string('plan_id').notNullable();
    table.decimal('amount', 10, 2).notNullable();
    table.string('currency').defaultTo('INR');
    table.string('order_id').unique().notNullable();
    table.string('cashfree_order_id');
    table.enum('status', ['pending', 'completed', 'failed']).defaultTo('pending');
    table.timestamps(true, true);
    table.index('user_id');
    table.index('status');
  });
};

export const down = async function (knex) {
  await knex.schema.dropTableIfExists('payment_orders');
  await knex.schema.dropTableIfExists('activity_logs');
  await knex.schema.dropTableIfExists('validation_rules');
  await knex.schema.dropTableIfExists('queries');
  await knex.schema.dropTableIfExists('dashboards');
  await knex.schema.dropTableIfExists('datasets');
  await knex.schema.dropTableIfExists('workspaces');
  await knex.schema.dropTableIfExists('subscriptions');
  await knex.schema.dropTableIfExists('users');
};
