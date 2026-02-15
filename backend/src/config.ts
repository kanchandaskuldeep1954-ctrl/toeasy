import dotenv from 'dotenv';
dotenv.config();

// Subscription tier limits
export const tierLimits = {
  basic: {
    maxDatasets: 3,
    maxRowsPerDataset: 500,
    maxGenerateRows: 500,
    aiQueriesPerDay: 10,
    maxWorkspaces: 2,
    maxConnectors: 1,
  },
  pro: {
    maxDatasets: 50,
    maxRowsPerDataset: 100000,
    maxGenerateRows: 100000,
    aiQueriesPerDay: 999999,
    maxWorkspaces: 10,
    maxConnectors: 10,
  },
  enterprise: {
    maxDatasets: 999999,
    maxRowsPerDataset: 10000000,
    maxGenerateRows: 10000000,
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
  resendApiKey: string | undefined;
  razorpay: {
    keyId: string | undefined;
    keySecret: string | undefined;
  };
  email: {
    host: string;
    port: number;
    user: string | undefined;
    pass: string | undefined;
    from: string;
    support: string;
    billing: string;
    privacy: string;
    phone: string;
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
  resendApiKey: process.env.RESEND_API_KEY,
  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID,
    keySecret: process.env.RAZORPAY_KEY_SECRET,
  },
  email: {
    host: (process.env.SMTP_HOST || 'smtp.gmail.com').replace(/"/g, ''),
    port: parseInt((process.env.SMTP_PORT || '587').replace(/"/g, '')),
    user: process.env.SMTP_USER?.replace(/"/g, ''),
    pass: process.env.SMTP_PASS?.replace(/"/g, ''),
    from: process.env.EMAIL_FROM || 'Toeasy AI <auth@toeasy.online>',
    support: process.env.EMAIL_SUPPORT || 'support@toeasy.online',
    billing: process.env.EMAIL_BILLING || 'billing@toeasy.online',
    privacy: process.env.EMAIL_PRIVACY || 'privacy@toeasy.online',
    phone: process.env.SUPPORT_PHONE || '+1 (888) TOEASY-AI',
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
  basic: {
    usd: { monthly: 0, yearly: 0 },
    inr: { monthly: 0, yearly: 0 }
  },
  pro: {
    usd: { monthly: 5, yearly: 48 },
    inr: { monthly: 99, yearly: 999 } // Monthly Recurring vs Annual Recurring
  },
  enterprise: {
    usd: { monthly: 19, yearly: 180 },
    inr: { monthly: 499, yearly: 4999 }
  },
};
