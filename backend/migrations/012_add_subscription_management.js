export async function up(knex) {
  // Add columns for subscription management
  await knex.raw(`
    ALTER TABLE subscriptions 
    ADD COLUMN IF NOT EXISTS razorpay_subscription_id VARCHAR(255),
    ADD COLUMN IF NOT EXISTS auto_renew BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS renewal_date TIMESTAMP WITH TIME ZONE
  `);

  console.log('Added subscription management columns');
}

export async function down(knex) {
  await knex.raw(`
    ALTER TABLE subscriptions 
    DROP COLUMN IF NOT EXISTS razorpay_subscription_id,
    DROP COLUMN IF NOT EXISTS auto_renew,
    DROP COLUMN IF NOT EXISTS renewal_date
  `);
}
