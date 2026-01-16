import dotenv from 'dotenv';

dotenv.config();

const config = {
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
      extension: "js",
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

// Export environment-specific config - fallback to production if env not found
const env = process.env.NODE_ENV || 'production';
export default config[env] || config.production || config.development;
