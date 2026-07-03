// ============================================
// Client: Analytics Routes
// ============================================

import { Router, Request, Response, NextFunction } from 'express';
import { query } from '../../db/client.js';
import { authenticate } from '../../middleware/auth.js';
import { tenantScope } from '../../middleware/tenantScope.js';

const router = Router();
router.use(authenticate, tenantScope);

// GET /api/client/analytics/overview — Dashboard stats
router.get('/overview', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.tenantId;

    const [conversations, leads, sources, messages] = await Promise.all([
      query('SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status = $2) as active FROM conversations WHERE tenant_id = $1', [tenantId, 'active']),
      query('SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status = $2) as new FROM leads_orders WHERE tenant_id = $1', [tenantId, 'new']),
      query('SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status = $2) as processing FROM sources WHERE tenant_id = $1', [tenantId, 'processing']),
      query('SELECT COUNT(*) as total FROM messages WHERE tenant_id = $1', [tenantId]),
    ]);

    res.json({
      success: true,
      data: {
        conversations: {
          total: parseInt(conversations.rows[0].total),
          active: parseInt(conversations.rows[0].active),
        },
        leads: {
          total: parseInt(leads.rows[0].total),
          new: parseInt(leads.rows[0].new),
        },
        sources: {
          total: parseInt(sources.rows[0].total),
          processing: parseInt(sources.rows[0].processing),
        },
        messages: {
          total: parseInt(messages.rows[0].total),
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/client/analytics/volume — Conversation volume over time
router.get('/volume', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const tenantId = req.tenantId;

    const result = await query(
      `SELECT 
        DATE(started_at) as date,
        COUNT(*) as conversations,
        COUNT(*) FILTER (WHERE channel = 'web') as web_count,
        COUNT(*) FILTER (WHERE channel = 'whatsapp') as whatsapp_count
       FROM conversations
       WHERE tenant_id = $1 AND started_at >= NOW() - INTERVAL '1 day' * $2
       GROUP BY DATE(started_at)
       ORDER BY date ASC`,
      [tenantId, days]
    );

    res.json({ success: true, data: result.rows });
  } catch (error) {
    next(error);
  }
});

// GET /api/client/analytics/top-questions — Most asked questions
router.get('/top-questions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const tenantId = req.tenantId;

    const result = await query(
      `SELECT content, COUNT(*) as frequency
       FROM messages
       WHERE tenant_id = $1 AND role = 'customer' AND LENGTH(content) > 10
       GROUP BY content
       ORDER BY frequency DESC
       LIMIT $2`,
      [tenantId, limit]
    );

    res.json({ success: true, data: result.rows });
  } catch (error) {
    next(error);
  }
});

// GET /api/client/analytics/unanswered — Questions the bot couldn't answer
router.get('/unanswered', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.tenantId;

    // Find messages where the bot responded with the fallback message
    const tenantResult = await query(
      'SELECT fallback_message FROM tenants WHERE id = $1',
      [tenantId]
    );
    const fallback = tenantResult.rows[0]?.fallback_message || "I'm sorry";

    const result = await query(
      `SELECT m_customer.content as question, m_bot.content as response, m_customer.created_at
       FROM messages m_customer
       JOIN messages m_bot ON m_bot.conversation_id = m_customer.conversation_id
         AND m_bot.created_at = (
           SELECT MIN(created_at) FROM messages
           WHERE conversation_id = m_customer.conversation_id
             AND created_at > m_customer.created_at AND role = 'assistant'
         )
       WHERE m_customer.tenant_id = $1
         AND m_customer.role = 'customer'
         AND m_bot.content ILIKE $2
       ORDER BY m_customer.created_at DESC
       LIMIT 50`,
      [tenantId, `%${fallback.slice(0, 20)}%`]
    );

    res.json({ success: true, data: result.rows });
  } catch (error) {
    next(error);
  }
});

export default router;
