/**
 * Migration: 026_work_os_modules.js
 * Creates tables for Chat, Tasks, Docs, Forms, Files modules
 */

export async function up(knex) {
    // ===== CHAT MODULE =====
    await knex.schema.createTable('channels', (table) => {
        table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
        table.integer('workspace_id').notNullable().references('id').inTable('workspaces').onDelete('CASCADE'); // Integer FK
        table.string('name').notNullable();
        table.text('description');
        table.enum('type', ['public', 'private', 'direct']).defaultTo('public');
        table.boolean('is_archived').defaultTo(false);
        table.integer('created_by').references('id').inTable('users'); // Integer FK
        table.timestamps(true, true);
        table.index(['workspace_id', 'type']);
    });

    await knex.schema.createTable('channel_members', (table) => {
        table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
        table.uuid('channel_id').notNullable().references('id').inTable('channels').onDelete('CASCADE');
        table.integer('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE'); // Integer FK
        table.enum('role', ['owner', 'admin', 'member']).defaultTo('member');
        table.timestamp('last_read_at');
        table.timestamps(true, true);
        table.unique(['channel_id', 'user_id']);
    });

    await knex.schema.createTable('messages', (table) => {
        table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
        table.uuid('channel_id').notNullable().references('id').inTable('channels').onDelete('CASCADE');
        table.integer('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE'); // Integer FK
        table.text('content').notNullable();
        table.uuid('parent_id').references('id').inTable('messages'); // Thread support
        table.jsonb('attachments').defaultTo('[]');
        table.jsonb('reactions').defaultTo('{}');
        table.boolean('is_edited').defaultTo(false);
        table.boolean('is_deleted').defaultTo(false);
        table.timestamps(true, true);
        table.index(['channel_id', 'created_at']);
    });

    // ===== TASKS MODULE =====
    await knex.schema.createTable('tasks', (table) => {
        table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
        table.integer('workspace_id').notNullable().references('id').inTable('workspaces').onDelete('CASCADE'); // Integer FK
        table.string('title').notNullable();
        table.text('description');
        table.enum('status', ['backlog', 'todo', 'in_progress', 'review', 'done']).defaultTo('backlog');
        table.enum('priority', ['low', 'medium', 'high', 'urgent']).defaultTo('medium');
        table.integer('assignee_id').references('id').inTable('users'); // Integer FK
        table.integer('created_by').references('id').inTable('users'); // Integer FK
        table.date('due_date');
        table.jsonb('tags').defaultTo('[]');
        table.uuid('parent_id').references('id').inTable('tasks'); // Subtasks
        table.integer('position').defaultTo(0);
        table.timestamps(true, true);
        table.index(['workspace_id', 'status']);
        table.index(['assignee_id']);
    });

    await knex.schema.createTable('task_comments', (table) => {
        table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
        table.uuid('task_id').notNullable().references('id').inTable('tasks').onDelete('CASCADE');
        table.integer('user_id').notNullable().references('id').inTable('users'); // Integer FK
        table.text('content').notNullable();
        table.timestamps(true, true);
    });

    // ===== DOCS MODULE =====
    await knex.schema.createTable('documents', (table) => {
        table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
        table.integer('workspace_id').notNullable().references('id').inTable('workspaces').onDelete('CASCADE'); // Integer FK
        table.string('title').notNullable();
        table.string('icon');
        table.string('cover_image');
        table.uuid('parent_id').references('id').inTable('documents'); // Nested docs
        table.integer('created_by').references('id').inTable('users'); // Integer FK
        table.boolean('is_starred').defaultTo(false);
        table.boolean('is_archived').defaultTo(false);
        table.timestamps(true, true);
        table.index(['workspace_id', 'parent_id']);
    });

    await knex.schema.createTable('document_blocks', (table) => {
        table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
        table.uuid('document_id').notNullable().references('id').inTable('documents').onDelete('CASCADE');
        table.enum('type', ['paragraph', 'h1', 'h2', 'h3', 'bulletList', 'numberedList', 'todo', 'quote', 'code', 'divider', 'image', 'callout']).defaultTo('paragraph');
        table.text('content');
        table.jsonb('properties').defaultTo('{}');
        table.integer('position').notNullable();
        table.timestamps(true, true);
        table.index(['document_id', 'position']);
    });

    // ===== FORMS MODULE =====
    await knex.schema.createTable('forms', (table) => {
        table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
        table.integer('workspace_id').notNullable().references('id').inTable('workspaces').onDelete('CASCADE'); // Integer FK
        table.string('title').notNullable();
        table.text('description');
        table.enum('status', ['draft', 'published', 'closed']).defaultTo('draft');
        table.integer('created_by').references('id').inTable('users'); // Integer FK
        table.jsonb('settings').defaultTo('{}');
        table.timestamps(true, true);
        table.index(['workspace_id', 'status']);
    });

    await knex.schema.createTable('form_fields', (table) => {
        table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
        table.uuid('form_id').notNullable().references('id').inTable('forms').onDelete('CASCADE');
        table.enum('type', ['text', 'email', 'phone', 'number', 'date', 'select', 'multiSelect', 'checkbox', 'toggle', 'textarea', 'file', 'rating']).notNullable();
        table.string('label').notNullable();
        table.text('placeholder');
        table.boolean('required').defaultTo(false);
        table.jsonb('options').defaultTo('[]');
        table.jsonb('validation').defaultTo('{}');
        table.integer('position').notNullable();
        table.timestamps(true, true);
        table.index(['form_id', 'position']);
    });

    await knex.schema.createTable('form_responses', (table) => {
        table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
        table.uuid('form_id').notNullable().references('id').inTable('forms').onDelete('CASCADE');
        table.integer('respondent_id').references('id').inTable('users'); // Integer FK
        table.jsonb('answers').notNullable();
        table.string('ip_address');
        table.timestamps(true, true);
        table.index(['form_id', 'created_at']);
    });

    // ===== FILES MODULE =====
    await knex.schema.createTable('folders', (table) => {
        table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
        table.integer('workspace_id').notNullable().references('id').inTable('workspaces').onDelete('CASCADE'); // Integer FK
        table.string('name').notNullable();
        table.uuid('parent_id').references('id').inTable('folders');
        table.integer('created_by').references('id').inTable('users'); // Integer FK
        table.boolean('is_starred').defaultTo(false);
        table.timestamps(true, true);
        table.index(['workspace_id', 'parent_id']);
    });

    await knex.schema.createTable('files', (table) => {
        table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
        table.integer('workspace_id').notNullable().references('id').inTable('workspaces').onDelete('CASCADE'); // Integer FK
        table.uuid('folder_id').references('id').inTable('folders').onDelete('SET NULL');
        table.string('name').notNullable();
        table.string('mime_type');
        table.bigInteger('size');
        table.string('storage_key'); // S3/Cloud storage key
        table.string('storage_url'); // Public URL
        table.integer('uploaded_by').references('id').inTable('users'); // Integer FK
        table.boolean('is_starred').defaultTo(false);
        table.timestamps(true, true);
        table.index(['workspace_id', 'folder_id']);
    });
}

export async function down(knex) {
    await knex.schema.dropTableIfExists('files');
    await knex.schema.dropTableIfExists('folders');
    await knex.schema.dropTableIfExists('form_responses');
    await knex.schema.dropTableIfExists('form_fields');
    await knex.schema.dropTableIfExists('forms');
    await knex.schema.dropTableIfExists('document_blocks');
    await knex.schema.dropTableIfExists('documents');
    await knex.schema.dropTableIfExists('task_comments');
    await knex.schema.dropTableIfExists('tasks');
    await knex.schema.dropTableIfExists('messages');
    await knex.schema.dropTableIfExists('channel_members');
    await knex.schema.dropTableIfExists('channels');
}
