import { PlanTier } from '../../types';

export interface PlanConfig {
    id: PlanTier;
    name: string;
    priceMonthly: number;
    priceYearly: number;
    description: string;
    features: string[];
    limitRows: number;
    limitQueries: number;
    highlight?: boolean;
}

export const BILLING_PLANS: PlanConfig[] = [
    {
        id: 'basic',
        name: 'Starter',
        priceMonthly: 0,
        priceYearly: 0,
        description: 'Ideal for small scale personal data projects.',
        features: ['Up to 500 rows', '10 AI Queries / day', '1 Data Connector', 'Basic Audit'],
        limitRows: 500,
        limitQueries: 10
    },
    {
        id: 'pro',
        name: 'Professional',
        priceMonthly: 29,
        priceYearly: 24,
        description: 'Powerful tools for data analysts and consultants.',
        features: ['Up to 50,000 rows', 'Unlimited AI Queries', '5 Data Connectors', 'Custom Validation Rules', 'Executive Reports'],
        highlight: true,
        limitRows: 50000,
        limitQueries: 999999
    },
    {
        id: 'enterprise',
        name: 'Enterprise',
        priceMonthly: 99,
        priceYearly: 82,
        description: 'The complete data OS for modern businesses.',
        features: ['Unlimited rows', 'Unlimited AI Queries', 'All Connectors (SQL, APIs)', 'Priority AI Processing', 'SSO & Advanced Security', 'API Access'],
        limitRows: 999999999,
        limitQueries: 999999
    }
];
