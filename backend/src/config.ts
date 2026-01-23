import dotenv from 'dotenv';
dotenv.config();

// Subscription tier limits
export const tierLimits = {
  basic: {
    maxDatasets: 3,
    maxRowsPerDataset: 500,
    maxGenerateRows: 100,
    aiQueriesPerDay: 10,
    maxWorkspaces: 1,
    maxConnectors: 1,
  },
  pro: {
    maxDatasets: 100,
    maxRowsPerDataset: 100000,
    maxGenerateRows: 100000,
    aiQueriesPerDay: 999999,
    maxWorkspaces: 20,
    maxConnectors: 10,
  },
  enterprise: {
    maxDatasets: 999999,
    maxRowsPerDataset: 1000000,
    maxGenerateRows: 1000000,
    aiQueriesPerDay: 999999,
    maxWorkspaces: 999999,
    maxConnectors: 999999,
  },
};

export interface Config {
  port: string | number;
  nodeEnv: string;
  databaseUrl: string | undefined;
  jwtSecret: string;
  jwtExpiry: string;
  refreshTokenExpiry: string;
  groqApiKey: string | undefined;
  razorpay: {
    keyId: string | undefined;
    keySecret: string | undefined;
  };
  redisUrl: string | undefined;
  frontendUrl: string;
  backendUrl: string;
  logLevel: string;
  tierLimits: typeof tierLimits;
}

export const config: Config = {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-key',
  jwtExpiry: process.env.JWT_EXPIRY || '7d',
  refreshTokenExpiry: process.env.REFRESH_TOKEN_EXPIRY || '30d',
  groqApiKey: process.env.GROQ_API_KEY,
  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID,
    keySecret: process.env.RAZORPAY_KEY_SECRET,
  },
  redisUrl: process.env.REDIS_URL,
  frontendUrl: process.env.FRONTEND_URL || 'https://toeasy.vercel.app',
  backendUrl: process.env.BACKEND_URL || 'http://localhost:3000',
  logLevel: process.env.LOG_LEVEL || 'info',
  tierLimits,
};

// Pricing
// Pricing
export const pricing = {
  basic: { monthly: 0, yearly: 0 },
  pro: { monthly: 29, yearly: 288 }, // $24/mo * 12 = 288
  enterprise: { monthly: 99, yearly: 984 }, // $82/mo * 12 = 984
};
