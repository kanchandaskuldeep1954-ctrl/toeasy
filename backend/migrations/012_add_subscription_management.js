export async function up(db) {
    // Add columns for subscription management
    await db.query(`
    ALTER TABLE subscriptions 
    ADD COLUMN IF NOT EXISTS razorpay_subscription_id VARCHAR(255),
    ADD COLUMN IF NOT EXISTS auto_renew BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS renewal_date TIMESTAMP WITH TIME ZONE
  `);

    console.log('Added subscription management columns');
}

export async function down(db) {
    await db.query(`
    ALTER TABLE subscriptions 
    DROP COLUMN IF NOT EXISTS razorpay_subscription_id,
    DROP COLUMN IF NOT EXISTS auto_renew,
    DROP COLUMN IF NOT EXISTS renewal_date
  `);
}
