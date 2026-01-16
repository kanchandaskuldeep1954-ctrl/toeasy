import bcryptjs from 'bcryptjs';

export const seed = async function(knex) {
  // Delete existing entries
  await knex('payment_orders').del();
  await knex('activity_logs').del();
  await knex('validation_rules').del();
  await knex('queries').del();
  await knex('dashboards').del();
  await knex('datasets').del();
  await knex('subscriptions').del();
  await knex('workspaces').del();
  await knex('users').del();

  // Hash password
  const passwordHash = await bcryptjs.hash('Test@123456', 12);

  // Create test user
  const [userId] = await knex('users').insert({
    email: 'test@example.com',
    password_hash: passwordHash,
    name: 'Test User'
  }).returning('id');

  // Create subscription
  const renewalDate = new Date();
  renewalDate.setDate(renewalDate.getDate() + 30);

  const [subscriptionId] = await knex('subscriptions').insert({
    user_id: userId,
    tier: 'pro',
    status: 'active',
    renewal_date: renewalDate
  }).returning('id');

  // Create workspace
  const [workspaceId] = await knex('workspaces').insert({
    user_id: userId,
    name: 'Default Workspace',
    description: 'My first workspace'
  }).returning('id');

  // Create sample dataset
  const sampleData = [
    { name: 'John', age: 28, department: 'Engineering', salary: 75000 },
    { name: 'Jane', age: 32, department: 'Marketing', salary: 65000 },
    { name: 'Bob', age: 25, department: 'Engineering', salary: 70000 },
    { name: 'Alice', age: 29, department: 'Sales', salary: 60000 },
    { name: 'Charlie', age: 35, department: 'Management', salary: 85000 }
  ];

  const [datasetId] = await knex('datasets').insert({
    workspace_id: workspaceId,
    user_id: userId,
    name: 'Sample Employee Data',
    file_name: 'employees.json',
    row_count: sampleData.length,
    column_count: 4,
    file_size: JSON.stringify(sampleData).length,
    raw_data: JSON.stringify(sampleData)
  }).returning('id');

  // Create sample dashboard
  const [dashboardId] = await knex('dashboards').insert({
    workspace_id: workspaceId,
    name: 'Sales Dashboard',
    description: 'Overview of sales metrics',
    layout: JSON.stringify([
      { type: 'bar', title: 'Sales by Department', x: 0, y: 0, width: 6, height: 4 },
      { type: 'pie', title: 'Department Distribution', x: 6, y: 0, width: 6, height: 4 }
    ])
  }).returning('id');

  // Create sample validation rule
  await knex('validation_rules').insert({
    dataset_id: datasetId,
    name: 'Null Check',
    rule_type: 'null_check',
    rule_definition: JSON.stringify({
      columns: ['name', 'age', 'department'],
      description: 'Ensure no null values'
    }),
    is_active: true
  });

  console.log('✅ Database seeded successfully');
  console.log(`Test user created: test@example.com / Test@123456`);
};
