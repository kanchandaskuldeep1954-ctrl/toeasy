/**
 * Migration: Add source classification fields to datasets table
 * Enables the Intelligent Core Loop by storing classification results
 */

export const up = async function (knex) {
    // Add classification fields to datasets table
    await knex.schema.alterTable('datasets', (table) => {
        // What type of data is this? (invoice, sales, HR, etc.)
        table.string('source_type', 50).defaultTo('generic_dataset');

        // How confident is the AI in this classification? (0-100)
        table.integer('classification_confidence').defaultTo(0);

        // What workflow should we suggest?
        table.string('suggested_workflow', 50).defaultTo('quick_exploration');

        // What entities were detected? (emails, currencies, dates, etc.)
        table.jsonb('detected_entities').defaultTo('[]');

        // Key insights about the data
        table.jsonb('key_insights').defaultTo('[]');

        // AI reasoning for the classification
        table.text('classification_reasoning');

        // User override - if they disagree with the AI
        table.string('user_override_type', 50);

        // Journey progress tracking
        table.string('current_journey_step', 50);
        table.jsonb('journey_progress').defaultTo('{}');
    });

    console.log('✅ Added source classification fields to datasets table');
};

export const down = async function (knex) {
    await knex.schema.alterTable('datasets', (table) => {
        table.dropColumn('source_type');
        table.dropColumn('classification_confidence');
        table.dropColumn('suggested_workflow');
        table.dropColumn('detected_entities');
        table.dropColumn('key_insights');
        table.dropColumn('classification_reasoning');
        table.dropColumn('user_override_type');
        table.dropColumn('current_journey_step');
        table.dropColumn('journey_progress');
    });

    console.log('⬇️ Removed source classification fields from datasets table');
};
