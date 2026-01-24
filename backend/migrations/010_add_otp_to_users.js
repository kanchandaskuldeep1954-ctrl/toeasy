export const up = async function (knex) {
    await knex.schema.table('users', (table) => {
        table.string('otp', 6);
        table.timestamp('otp_expiry');
        table.boolean('is_verified').defaultTo(false);
        table.string('phone_number');
    });
};

export const down = async function (knex) {
    await knex.schema.table('users', (table) => {
        table.dropColumn('otp');
        table.dropColumn('otp_expiry');
        table.dropColumn('is_verified');
        table.dropColumn('phone_number');
    });
};
