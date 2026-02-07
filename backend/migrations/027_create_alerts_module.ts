import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
    // Create Alerts Table
    await knex.schema.createTable("alerts", (table) => {
        table.increments("id").primary();
        table.integer("workspace_id").notNullable();
        // Assuming we link to metrics by ID, though source could be flexible.
        // Making metric_id nullable for now as alerts could be strictly SQL-based or internal logic.
        table.integer("metric_id").nullable();
        table.string("name").notNullable();
        table.string("condition_type").notNullable(); // GT, LT, EQ
        table.float("threshold_value").notNullable();
        table.string("frequency").defaultTo("daily"); // daily, hourly, realtime
        table.integer("owner_id").notNullable(); // user_id
        table.boolean("is_active").defaultTo(true);
        table.timestamps(true, true);

        // Indexes
        table.index(["workspace_id"]);
        table.index(["owner_id"]);
    });

    // Create Notifications Table
    await knex.schema.createTable("notifications", (table) => {
        table.increments("id").primary();
        table.integer("user_id").notNullable();
        table.integer("workspace_id").notNullable();
        table.string("title").notNullable();
        table.text("message").nullable();
        table.string("type").defaultTo("alert"); // alert, system, info
        table.boolean("is_read").defaultTo(false);
        table.timestamps(true, true);

        // Indexes
        table.index(["user_id"]);
        table.index(["workspace_id"]);
        table.index(["is_read"]);
    });

    // Create Alert History Table (for tracking trigger events)
    await knex.schema.createTable("alert_history", (table) => {
        table.increments("id").primary();
        table.integer("alert_id").references("id").inTable("alerts").onDelete("CASCADE");
        table.float("value_at_trigger").notNullable();
        table.timestamp("triggered_at").defaultTo(knex.fn.now());

        // Indexes
        table.index(["alert_id"]);
    });
}

export async function down(knex: Knex): Promise<void> {
    await knex.schema.dropTableIfExists("alert_history");
    await knex.schema.dropTableIfExists("notifications");
    await knex.schema.dropTableIfExists("alerts");
}
