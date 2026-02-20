import test from 'node:test';
import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import express from 'express';
import { AddressInfo } from 'node:net';
import billingRouter from './billing.js';
import { authenticateToken, generateToken } from '../middleware/auth.js';
import { resetQueryOverrideForTests, setQueryOverrideForTests } from '../db.js';

function normalizeSql(text: string): string {
  return String(text || '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function createBillingQueryMock() {
  const calls: Array<{ sql: string; params: any[] }> = [];

  const query = async (text: string, params: any[] = []) => {
    const sql = normalizeSql(text);
    calls.push({ sql, params });

    if (sql.includes('from workspaces w') && sql.includes('left join workspace_members')) {
      return { rows: [{ id: 1 }] };
    }

    if (sql.includes('from subscriptions') && sql.includes('where user_id = $1')) {
      return {
        rows: [
          {
            id: 21,
            tier: 'pro',
            status: 'active',
            current_period_start: '2026-02-01T00:00:00.000Z',
            current_period_end: '2026-03-01T00:00:00.000Z',
            renewal_date: '2026-03-01T00:00:00.000Z'
          }
        ]
      };
    }

    if (sql.includes('from workspace_members') && sql.includes('(1 + count(*))::int as seats')) {
      return { rows: [{ seats: 3 }] };
    }

    if (sql.includes('insert into payment_orders')) {
      return { rows: [] };
    }

    return { rows: [] };
  };

  return { query, calls };
}

async function startBillingServer(mockQuery: (sql: string, params?: any[]) => Promise<{ rows: any[] }>) {
  setQueryOverrideForTests(mockQuery as any);
  const app = express();
  app.use(express.json());
  app.use('/api/billing', authenticateToken, billingRouter);
  const server: Server = await new Promise((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });
  return server;
}

async function stopBillingServer(server: Server) {
  await new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
  resetQueryOverrideForTests();
}

async function requestJson(params: {
  baseUrl: string;
  path: string;
  token: string;
  method?: 'GET' | 'POST';
  body?: any;
}) {
  const response = await fetch(`${params.baseUrl}${params.path}`, {
    method: params.method || 'GET',
    headers: {
      Authorization: `Bearer ${params.token}`,
      'Content-Type': 'application/json'
    },
    body: params.body ? JSON.stringify(params.body) : undefined
  });
  const payload = await response.json().catch(() => ({}));
  return { response, payload };
}

test('billing plans endpoint returns PMF packaging tiers', async () => {
  const mock = createBillingQueryMock();
  const server = await startBillingServer(mock.query);
  const token = generateToken('1', 'analyst@example.com', 'pro');
  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    const result = await requestJson({
      baseUrl,
      path: '/api/billing/plans',
      token
    });
    assert.equal(result.response.status, 200);
    assert.equal(Array.isArray(result.payload.plans), true);
    assert.ok(result.payload.plans.some((plan: any) => plan.id === 'solo_analyst'));
    assert.ok(result.payload.plans.some((plan: any) => plan.id === 'decision_room_pilot'));
  } finally {
    await stopBillingServer(server);
  }
});

test('billing subscription endpoint maps user subscription to PMF tier and seat count', async () => {
  const mock = createBillingQueryMock();
  const server = await startBillingServer(mock.query);
  const token = generateToken('1', 'analyst@example.com', 'pro');
  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    const result = await requestJson({
      baseUrl,
      path: '/api/billing/subscription?workspaceId=1',
      token
    });
    assert.equal(result.response.status, 200);
    assert.equal(result.payload.tier, 'solo_analyst');
    assert.equal(Number(result.payload.seats), 3);
    assert.equal(result.payload.status, 'active');
  } finally {
    await stopBillingServer(server);
  }
});

test('billing checkout endpoint creates pending checkout intent', async () => {
  const mock = createBillingQueryMock();
  const server = await startBillingServer(mock.query);
  const token = generateToken('1', 'analyst@example.com', 'pro');
  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    const result = await requestJson({
      baseUrl,
      path: '/api/billing/checkout',
      token,
      method: 'POST',
      body: {
        workspaceId: 1,
        tier: 'solo_analyst',
        billingCycle: 'monthly',
        seats: 2,
        currency: 'USD'
      }
    });
    assert.equal(result.response.status, 201, JSON.stringify(result.payload));
    assert.equal(result.payload.tier, 'solo_analyst');
    assert.equal(result.payload.billingCycle, 'monthly');
    assert.equal(Number(result.payload.amount), 98);
    assert.equal(result.payload.status, 'pending');
  } finally {
    await stopBillingServer(server);
  }
});
