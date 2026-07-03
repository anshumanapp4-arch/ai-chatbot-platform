// ============================================
// Express Server Entry Point
// ============================================

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { createServer } from 'http';
import { config } from './config/index.js';
import { testConnection } from './db/client.js';
import { startIngestionWorker } from './workers/ingestionWorker.js';
import { logger } from './utils/logger.js';
import { AppError } from './utils/errors.js';

// Route imports
import authRoutes from './routes/auth.js';
import chatRoutes from './routes/chat.js';
import adminTenantRoutes from './routes/admin/tenants.js';
import adminBillingRoutes from './routes/admin/billing.js';
import clientSourceRoutes from './routes/client/sources.js';
import clientConversationRoutes from './routes/client/conversations.js';
import clientLeadRoutes from './routes/client/leads.js';
import clientAnalyticsRoutes from './routes/client/analytics.js';
import clientExportRoutes from './routes/client/exports.js';
import clientSettingsRoutes from './routes/client/settings.js';
import clientWhatsappRoutes from './routes/client/whatsapp.js';
import whatsappWebhookRoutes from './routes/webhooks/whatsapp.js';
import paymentWebhookRoutes from './routes/webhooks/payments.js';

const app = express();
app.set('trust proxy', 1);
const server = createServer(app);

// ---- Global Middleware ----
app.use(helmet({ contentSecurityPolicy: false }));
const allowedOrigins = [
  config.frontendUrl,
  config.widgetOrigin,
  'https://ai-chatbot-web.vercel.app',
  'https://ai-chatbot-widget.vercel.app'
].flatMap(url => url ? url.split(',').map(s => s.trim()) : []);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || 
        allowedOrigins.includes(origin) || 
        allowedOrigins.includes('*') || 
        origin.endsWith('.vercel.app')
    ) {
      callback(null, true);
    } else {
      callback(null, false); // Fail silently or callback error
    }
  },
  credentials: true,
}));
app.use(morgan('short'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ---- Health Check ----
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ---- Route Registration ----
app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);

// Webhook routes (placed before global json middleware if raw payload needed, but here raw parser is handled inside route definitions)
app.use('/api/webhooks/whatsapp', whatsappWebhookRoutes);
app.use('/api/webhooks/payments', paymentWebhookRoutes);

// Admin routes
app.use('/api/admin/tenants', adminTenantRoutes);
app.use('/api/admin/billing', adminBillingRoutes);

// Client routes
app.use('/api/client/sources', clientSourceRoutes);
app.use('/api/client/conversations', clientConversationRoutes);
app.use('/api/client/leads', clientLeadRoutes);
app.use('/api/client/analytics', clientAnalyticsRoutes);
app.use('/api/client/exports', clientExportRoutes);
app.use('/api/client/settings', clientSettingsRoutes);
app.use('/api/client/whatsapp', clientWhatsappRoutes);

// ---- 404 Handler ----
app.use((_req, res) => {
  res.status(404).json({ success: false, error: 'Route not found' });
});

// ---- Global Error Handler ----
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: err.message,
      code: err.code,
      details: err.details,
    });
  } else {
    logger.error('Unhandled error', { error: err.message, stack: err.stack });
    res.status(500).json({
      success: false,
      error: config.env === 'production' ? 'Internal server error' : err.message,
    });
  }
});

// ---- Start Server ----
async function start() {
  try {
    // Test database connection
    await testConnection();

    // Start background workers
    startIngestionWorker();
    logger.info('✅ Ingestion worker started');

    // Start HTTP server
    server.listen(config.port, () => {
      logger.info(`🚀 Server running on http://localhost:${config.port}`);
      logger.info(`📊 Environment: ${config.env}`);
    });
  } catch (error) {
    logger.error('Failed to start server', { error: String(error) });
    process.exit(1);
  }
}

start();

export { app, server };
