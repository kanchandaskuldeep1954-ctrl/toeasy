
exports.up = function (knex) {
    return knex.schema.table('users', function (table) {
        table.boolean('onboarding_completed').defaultTo(false);
    });
};

exports.down = function (knex) {
    return knex.schema.table('users', function (table) {
        table.dropColumn('onboarding_completed');
    });
};
