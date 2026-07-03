// ============================================
// Client: Conversations Routes
// ============================================

import { Router, Request, Response, NextFunction } from 'express';
import { query } from '../../db/client.js';
import { authenticate } from '../../middleware/auth.js';
import { tenantScope } from '../../middleware/tenantScope.js';
import { paginationSchema } from '@chatbot/shared';
import { NotFoundError } from '../../utils/errors.js';

const router = Router();
router.use(authenticate, tenantScope);

// GET /api/client/conversations — List conversations
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, per_page, search } = paginationSchema.parse(req.query);
    const offset = (page - 1) * per_page;
    const channel = req.query.channel as string;
    const status = req.query.status as string;

    let whereClause = 'WHERE c.tenant_id = $1';
    const params: unknown[] = [req.tenantId];

    if (channel) {
      params.push(channel);
      whereClause += ` AND c.channel = $${params.length}`;
    }
    if (status) {
      params.push(status);
      whereClause += ` AND c.status = $${params.length}`;
    }
    if (search) {
      params.push(`%${search}%`);
      whereClause += ` AND c.customer_identifier ILIKE $${params.length}`;
    }

    const countResult = await query(
      `SELECT COUNT(*) FROM conversations c ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const result = await query(
      `SELECT c.*,
        (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id) as message_count,
        (SELECT content FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) as last_message
       FROM conversations c
       ${whereClause}
       ORDER BY c.last_message_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, per_page, offset]
    );

    res.json({
      success: true,
      data: result.rows,
      total,
      page,
      per_page,
      total_pages: Math.ceil(total / per_page),
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/client/conversations/:id — Get conversation with messages
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const convResult = await query(
      'SELECT * FROM conversations WHERE id = $1 AND tenant_id = $2',
      [req.params.id, req.tenantId]
    );

    if (convResult.rows.length === 0) {
      throw new NotFoundError('Conversation', req.params.id as string);
    }

    const messagesResult = await query(
      'SELECT * FROM messages WHERE conversation_id = $1 ORDER BY created_at ASC',
      [req.params.id]
    );

    res.json({
      success: true,
      data: {
        conversation: convResult.rows[0],
        messages: messagesResult.rows,
      },
    });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/client/conversations/:id/status — Update conversation status
router.patch('/:id/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status } = req.body;
    const validStatuses = ['active', 'handled', 'handoff'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status' });
    }

    const result = await query(
      'UPDATE conversations SET status = $1 WHERE id = $2 AND tenant_id = $3 RETURNING *',
      [status, req.params.id, req.tenantId]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('Conversation', req.params.id as string);
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

export default router;
