import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from './config.js';
import { initializeRedis, closeRedis } from './services/cacheService.js';
import { closeAutomationQueue, initializeAutomationQueue } from './services/automationQueueService.js';
import { cacheMiddleware, invalidateCacheMiddleware } from './middleware/cacheMiddleware.js';
import { authenticateToken, AuthRequest, optionalAuthenticateToken } from './middleware/auth.js';
import { checkSubscription, checkTierLimit } from './middleware/subscription.js';
import { GroqService } from './services/groq.service.js';
import { query } from './db.js';
import { ScraperService } from './services/scraper.service.js';
import { logger } from './utils/logger.js';
import { requestLogger } from './middleware/requestLogger.js';

// Import routes
import authRoutes from './routes/auth.js';
import workspaceRoutes from './routes/workspaces.js';
import datasetRoutes from './routes/datasets.js';
import dashboardRoutes from './routes/dashboards.js';
import queryRoutes from './routes/queries.js';
import validationRoutes from './routes/validation.js';
import subscriptionRoutes from './routes/subscriptions.js';
import paymentRoutes from './routes/payments.js';
import userRoutes from './routes/users.js';
import analyticsRoutes from './routes/analytics.js';
import cleaningRoutes from './routes/cleaning.js';
import dataflowRoutes from './routes/dataflows.js';
import integrationRoutes from './routes/integrations.js';
import sharingRoutes from './routes/sharing.js';
import invitesRoutes from './routes/invites.js';
import tabsRoutes from './routes/tabs.js';
import activityRoutes from './routes/activity.js';
import metricsRoutes from './routes/metrics.js';
import reportRoutes from './routes/reports.js';
import classificationRoutes from './routes/classification.js';
import studioRoutes from './routes/studio.js';
import billingRoutes from './routes/billing.js';

// Work OS Modules
import chatRoutes from './routes/chat.js';
import tasksRoutes from './routes/tasks.js';
import docsRoutes from './routes/docs.js';
import formsRoutes from './routes/forms.js';
import filesRoutes from './routes/files.js';
import alertsRoutes from './routes/alerts.js';
import notificationsRoutes from './routes/notifications.js';
import briefRoutes from './routes/brief.js';
import { setupWebSocket } from './websocket.js'; // Import WebSocket Setup

const app = express();

// Middleware
app.use(helmet());
app.use(cors({
  origin: config.frontendUrl,
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Trust proxy for Railway deployment
app.set('trust proxy', 1);

// Populate req.user early when a valid Bearer token exists.
// This prevents cache keys from collapsing to "anonymous" and accidentally serving
// authenticated responses to unauthenticated clients.
app.use(optionalAuthenticateToken);

// Cache middleware for GET requests (5 minute TTL)
app.use(cacheMiddleware({
  ttl: 300,
  shouldCache: (req) => {
    // Work OS modules are interactive; caching them causes stale UI and missing invalidations.
    const url = req.originalUrl || req.url || '';
    const skipPrefixes = [
      '/api/chat',
      '/api/tasks',
      '/api/docs',
      '/api/forms',
      '/api/files',
      '/api/alerts',
      '/api/notifications'
    ];
    return !skipPrefixes.some((p) => url.startsWith(p));
  }
}));

// Cache invalidation middleware for mutations
app.use(invalidateCacheMiddleware());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // limit each IP to 500 requests per windowMs
  message: 'Too many requests, please try again later.'
});

app.use('/api/', limiter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Request Logger
app.use(requestLogger);

// API Routes
app.use('/api/auth', authRoutes);

// Test DB Route to debug schema (development-only)
if (config.nodeEnv === 'development') {
  app.get('/api/test-db', async (req, res) => {
    try {
      const tableResult = await query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
      `);

      // Check specific columns in datasets
      const columnsResult = await query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'datasets'
      `);

      res.json({
        status: 'Available',
        tables: tableResult.rows.map(r => r.table_name),
        datasetColumns: columnsResult.rows
      });
    } catch (err: any) {
      res.status(500).json({ error: 'DB Connection Failed', details: err.message });
    }
  });
}
app.use('/api/workspaces', workspaceRoutes);
app.use('/api/workspaces', datasetRoutes);
app.use('/api/workspaces', dashboardRoutes);
app.use('/api/workspaces', reportRoutes);
app.use('/api/workspaces', queryRoutes); // includes /workspaces/:id/datasets/:id/query
app.use('/api/workspaces', validationRoutes);
app.use('/api/workspaces', studioRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/users', userRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/workspaces', cleaningRoutes);
app.use('/api/workspaces', dataflowRoutes);
app.use('/api/integrations', authenticateToken, integrationRoutes);
app.use('/api/sharing', sharingRoutes); // Public share links (some routes require auth, some don't)
app.use('/api/tabs', authenticateToken, tabsRoutes); // Workspace tabs
app.use('/api/activity', authenticateToken, activityRoutes); // Activity Log
app.use('/api', metricsRoutes); // Metrics Library
app.use('/api', classificationRoutes); // Source Classification (Phase 1: Intelligent Core Loop)

// Work OS Modules
app.use('/api/chat', authenticateToken, chatRoutes);
app.use('/api/tasks', authenticateToken, tasksRoutes);
app.use('/api/docs', authenticateToken, docsRoutes);
// Forms include a public submit endpoint (`POST /api/forms/:id/respond`) and must not be globally auth-guarded.
app.use('/api/forms', formsRoutes);
app.use('/api/files', authenticateToken, filesRoutes);
app.use('/api/alerts', authenticateToken, alertsRoutes);
app.use('/api/notifications', authenticateToken, notificationsRoutes);
app.use('/api/invites', invitesRoutes); // invites has its own auth middleware inside
app.use('/api/billing', authenticateToken, billingRoutes);
app.use('/api/workspaces', briefRoutes); // Decision Brief MVP

// Top-level AI endpoints (not nested under workspaces)
app.post('/api/generate-sql', authenticateToken, checkSubscription, checkTierLimit('aiQueriesPerDay'), async (req: AuthRequest, res) => {
  try {
    const { dataset, query: nlQuery } = req.body;

    if (!nlQuery) {
      return res.status(400).json({ error: 'Query required' });
    }

    if (!dataset) {
      return res.status(400).json({ error: 'Dataset required' });
    }

    console.log('Generating SQL for query:', nlQuery);
    console.log('Dataset:', JSON.stringify(dataset).substring(0, 100));

    // Use GroqService to generate SQL from natural language
    const result = await GroqService.generateSQL(dataset, nlQuery);

    console.log('Generated SQL:', result.sql);

    res.json({
      sql: result.sql,
      explanation: result.explanation || ''
    });
  } catch (err) {
    console.error('Generate SQL error:', err instanceof Error ? err.message : err);
    console.error('Full error:', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to generate SQL' });
  }
});

// Generate synthetic dataset endpoint
app.post('/api/generate-synthetic', authenticateToken, checkSubscription, checkTierLimit('aiQueriesPerDay'), async (req: AuthRequest, res) => {
  try {
    const { topic, fields, count } = req.body;

    if (!topic || !fields || !count) {
      return res.status(400).json({ error: 'Topic, fields, and count required' });
    }

    // Use centralized limits from middleware
    const limits = (req as any).tierLimits || config.tierLimits[req.user!.tier as keyof typeof config.tierLimits] || config.tierLimits.basic;
    const maxRows = limits.maxGenerateRows;

    if (count > maxRows) {
      return res.status(400).json({
        error: `Your ${req.user!.tier} plan allows maximum ${maxRows} rows. Upgrade to generate more.`,
        maxAllowed: maxRows,
        tier: req.user!.tier
      });
    }

    console.log(`Generating ${count} synthetic rows for topic: ${topic}`);

    // Generate synthetic data with enhanced prompting
    const syntheticData = await GroqService.generateSyntheticData(
      topic,
      fields,
      Math.min(count, maxRows)
    );

    if (!syntheticData || syntheticData.length === 0) {
      return res.status(500).json({ error: 'Failed to generate synthetic data' });
    }

    console.log(`Generated ${syntheticData.length} synthetic rows`);

    res.json({
      data: syntheticData,
      count: syntheticData.length,
      topic,
      fields,
      tier: req.user!.tier,
      maxAllowed: maxRows,
      generatedAt: new Date().toISOString()
    });
  } catch (err) {
    console.error('Generate synthetic data error:', err instanceof Error ? err.message : err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to generate synthetic data' });
  }
});

// ===== AI DASHBOARD ENDPOINTS =====

// Suggest Dashboard Config from Dataset
app.post('/api/suggest-dashboard', authenticateToken, checkSubscription, checkTierLimit('aiQueriesPerDay'), async (req: AuthRequest, res) => {
  try {
    const { dataset } = req.body;

    if (!dataset) {
      return res.status(400).json({ error: 'Dataset required' });
    }

    console.log('Suggesting dashboard for dataset with', dataset.data?.length || 0, 'rows');

    const config = await GroqService.suggestDashboard(dataset);

    res.json(config);
  } catch (err) {
    console.error('Suggest dashboard error:', err instanceof Error ? err.message : err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to suggest dashboard' });
  }
});

// Modify Chart with AI
app.post('/api/modify-chart', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { dataset, chart, prompt } = req.body;

    if (!dataset || !chart || !prompt) {
      return res.status(400).json({ error: 'Dataset, chart, and prompt required' });
    }

    console.log('Modifying chart:', chart.title, 'with prompt:', prompt);

    const modifiedChart = await GroqService.modifyChartWithAI(dataset, chart, prompt);

    res.json(modifiedChart);
  } catch (err) {
    console.error('Modify chart error:', err instanceof Error ? err.message : err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to modify chart' });
  }
});

// Generate Chart from Prompt
app.post('/api/generate-chart', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { dataset, prompt } = req.body;

    if (!dataset || !prompt) {
      return res.status(400).json({ error: 'Dataset and prompt required' });
    }

    console.log('Generating chart from prompt:', prompt);

    const chart = await GroqService.generateChartFromPrompt(dataset, prompt);

    res.json(chart);
  } catch (err) {
    console.error('Generate chart error:', err instanceof Error ? err.message : err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to generate chart' });
  }
});

// Generate KPI from Prompt
app.post('/api/generate-kpi', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { dataset, prompt } = req.body;
    if (!dataset || !prompt) return res.status(400).json({ error: 'Dataset and prompt required' });
    const kpi = await GroqService.generateKPIFromPrompt(dataset, prompt);
    res.json(kpi);
  } catch (err) {
    console.error('Generate KPI error:', err);
    res.status(500).json({ error: 'Failed to generate KPI' });
  }
});

// Modify KPI with AI
app.post('/api/modify-kpi', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { dataset, kpi, prompt } = req.body;
    if (!dataset || !kpi || !prompt) return res.status(400).json({ error: 'Dataset, KPI, and prompt required' });
    const modifiedKpi = await GroqService.modifyKPIWithAI(dataset, kpi, prompt);
    res.json(modifiedKpi);
  } catch (err) {
    console.error('Modify KPI error:', err);
    res.status(500).json({ error: 'Failed to modify KPI' });
  }
});

// Generate Strategic Report
app.post('/api/generate-report', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { dataset, reportType, extraContext } = req.body;

    if (!dataset) {
      return res.status(400).json({ error: 'Dataset required' });
    }

    console.log(`Generating ${reportType || 'strategic'} report with extraContext:`, !!extraContext);

    const report = await GroqService.generateReport(dataset, reportType, extraContext);

    res.json(report);
  } catch (err) {
    console.error('Generate report error:', err instanceof Error ? err.message : err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to generate report' });
  }
});

// Modify Report with AI (Copilot)
app.post('/api/modify-report', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { dataset, report, instruction } = req.body;

    if (!dataset || !report || !instruction) {
      return res.status(400).json({ error: 'Dataset, report, and instruction required' });
    }

    console.log('Modifying report with instruction:', instruction);

    const modifiedReport = await GroqService.modifyReportWithAI(dataset, report, instruction);

    res.json(modifiedReport);
  } catch (err) {
    console.error('Modify report error:', err instanceof Error ? err.message : err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to modify report' });
  }
});

// Consult Verified Agent (Chat/Q&A)
app.post('/api/consult-agent', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { dataset, query, context, history } = req.body;

    if (!dataset || !query) {
      return res.status(400).json({ error: 'Dataset and query required' });
    }

    console.log('Consulting agent with query:', query);

    const response = await GroqService.consultAgent(dataset, query, context, history);

    res.json({ result: response });
  } catch (err) {
    console.error('Consult agent error:', err instanceof Error ? err.message : err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to consult agent' });
  }
});

// Deep Semantic Analysis
app.post('/api/analyze', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { dataset } = req.body;
    if (!dataset) return res.status(400).json({ error: 'Dataset required' });

    const analysis = await GroqService.analyzeDatasetSemantics(dataset);
    res.json({ result: analysis }); // Wrap in result object to match frontend expectation
  } catch (err) {
    console.error('Analysis error:', err);
    res.status(500).json({ error: 'Failed to analyze dataset' });
  }
});

// Suggest Rules
app.post('/api/suggest-rules', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { dataset, semanticContext } = req.body;
    if (!dataset) return res.status(400).json({ error: 'Dataset required' });

    const rules = await GroqService.suggestValidationRules(dataset, semanticContext);
    res.json({ rules });
  } catch (err) {
    console.error('Suggest rules error:', err);
    res.status(500).json({ error: 'Failed to suggest rules' });
  }
});

// Generate Logic
app.post('/api/generate-logic', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { dataset, category, title } = req.body; // Frontend sends 'title' as description
    if (!dataset) return res.status(400).json({ error: 'Dataset required' });

    const logic = await GroqService.generateLogicFromDescription(dataset, category, title);
    res.json(logic);
  } catch (err) {
    console.error('Generate logic error:', err);
    res.status(500).json({ error: 'Failed to generate logic' });
  }
});

// Real Web Scraper endpoint
app.post('/api/scrape', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { url, topic, fields, count } = req.body;

    if (!url || !topic || !count) {
      return res.status(400).json({ error: 'URL, topic, and count required' });
    }

    // Check subscription tier for max rows
    const userResult = await query(
      'SELECT tier FROM subscriptions WHERE user_id = $1 AND status = $2 ORDER BY created_at DESC LIMIT 1',
      [req.user!.id, 'active']
    );

    const tier = userResult.rows.length > 0 ? userResult.rows[0].tier : 'basic';
    const limits = config.tierLimits[tier as keyof typeof config.tierLimits] || config.tierLimits.basic;
    const maxRows = limits.maxRowsPerDataset;

    if (count > maxRows) {
      return res.status(400).json({
        error: `Your ${tier} plan allows maximum ${maxRows} rows per dataset. Upgrade to scrape more.`,
        maxAllowed: maxRows,
        tier
      });
    }

    console.log(`Real scrape requested for: ${url}, target count: ${count}`);

    const scrapedData = await ScraperService.scrapeUrl(
      url,
      topic,
      fields || [],
      Math.min(count, maxRows)
    );

    res.json({
      data: scrapedData,
      count: scrapedData.length,
      limitApplied: count > maxRows,
      tier
    });
  } catch (err) {
    console.error('Scrape error:', err instanceof Error ? err.message : err);
    res.status(500).json({ error: 'Failed to scrape web data' });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    details: err.details || JSON.stringify(err),
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

const PORT = config.port || 3000;

// Initialize Redis and start server
async function startServer() {
  try {
    logger.info('[STARTUP] Initializing Redis...');
    // Initialize Redis cache
    await initializeRedis(config.redisUrl);
    logger.info('[STARTUP] Redis initialized');

    logger.info('[STARTUP] Initializing Automation Queue...');
    await initializeAutomationQueue(config.redisUrl);
    logger.info('[STARTUP] Automation Queue initialized');

    logger.info('[STARTUP] Starting Express server on port', PORT);
    const server = app.listen(PORT, () => {
      logger.info(`Backend server running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`JWT Secret configured: ${config.jwtSecret ? 'Yes (' + config.jwtSecret.substring(0, 3) + '...)' : 'No'}`);
    });

    logger.info('[STARTUP] Setting up WebSockets...');
    // Initialize WebSockets
    setupWebSocket(server);
    logger.info('[STARTUP] WebSockets ready');

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      logger.info('SIGTERM received, shutting down gracefully...');
      server.close(async () => {
        await closeAutomationQueue();
        await closeRedis();
        process.exit(0);
      });
    });

    process.on('SIGINT', async () => {
      logger.info('SIGINT received, shutting down gracefully...');
      server.close(async () => {
        await closeAutomationQueue();
        await closeRedis();
        process.exit(0);
      });
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

export default app;
