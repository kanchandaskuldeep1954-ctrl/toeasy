
export async function up(knex) {
    return knex.schema.table('users', function (table) {
        table.boolean('onboarding_completed').defaultTo(false);
    });
}

export async function down(knex) {
    return knex.schema.table('users', function (table) {
        table.dropColumn('onboarding_completed');
    });
}
