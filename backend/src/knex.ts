import knex from 'knex';
import { config } from './config.js';

const db = knex({
    client: 'pg',
    connection: config.databaseUrl || {
        host: '127.0.0.1',
        user: 'postgres',
        password: 'password',
        database: 'toeasy'
    },
    pool: {
        min: 2,
        max: 10
    }
});

export default db;
