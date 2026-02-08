import type { Knex } from "knex";
import dotenv from 'dotenv';

dotenv.config();

const config: { [key: string]: Knex.Config } = {
  development: {
    client: "pg",
    connection: process.env.DATABASE_URL || {
      host: "localhost",
      port: 5432,
      user: "postgres",
      password: "password",
      database: "toeasy_dev",
    },
    migrations: {
      directory: "./migrations",
      extension: "ts",
    },
    seeds: {
      directory: "./seeds",
      extension: "ts",
    },
  },

  production: {
    client: "pg",
    connection: process.env.DATABASE_URL,
    migrations: {
      directory: "./migrations",
      extension: "js",
    },
    seeds: {
      directory: "./seeds",
      extension: "ts",
    },
  },
};

export default config;
