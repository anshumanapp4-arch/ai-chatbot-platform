// ============================================
// Client: Bot Settings Routes
// ============================================

import { Router, Request, Response, NextFunction } from 'express';
import { query, transaction } from '../../db/client.js';
import { authenticate } from '../../middleware/auth.js';
import { tenantScope } from '../../middleware/tenantScope.js';
import { botSettingsSchema } from '@chatbot/shared';
import { ValidationError, NotFoundError } from '../../utils/errors.js';

const router = Router();
router.use(authenticate, tenantScope);

// GET /api/client/settings — Get bot settings
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await query(
      `SELECT bot_persona, fallback_message, handoff_trigger, business_hours,
              llm_provider, llm_model, embedding_provider, embedding_model
       FROM tenants WHERE id = $1`,
      [req.tenantId]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('Tenant');
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// PUT /api/client/settings — Update bot settings
router.put('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = botSettingsSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError('Invalid input', parsed.error.flatten());
    }

    const { bot_persona, fallback_message, handoff_trigger, business_hours } = parsed.data;

    const result = await query(
      `UPDATE tenants SET
        bot_persona = $1,
        fallback_message = $2,
        handoff_trigger = $3,
        business_hours = $4
       WHERE id = $5 RETURNING bot_persona, fallback_message, handoff_trigger, business_hours`,
      [bot_persona, fallback_message, handoff_trigger || null, business_hours ? JSON.stringify(business_hours) : null, req.tenantId]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('Tenant');
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/client/settings/purge — Purge all tenant data (PII, sources, chunks, conversations)
router.delete('/purge', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await transaction(async (client) => {
      // Delete in correct order to respect constraints (though cascade handles it, explicit makes it safe)
      await client.query('DELETE FROM chunks WHERE tenant_id = $1', [req.tenantId]);
      await client.query('DELETE FROM sources WHERE tenant_id = $1', [req.tenantId]);
      await client.query('DELETE FROM payments WHERE tenant_id = $1', [req.tenantId]);
      await client.query('DELETE FROM leads_orders WHERE tenant_id = $1', [req.tenantId]);
      await client.query('DELETE FROM messages WHERE tenant_id = $1', [req.tenantId]);
      await client.query('DELETE FROM conversations WHERE tenant_id = $1', [req.tenantId]);
    });

    res.json({
      success: true,
      message: 'All custom tenant data, RAG chunks, and customer PII have been purged successfully.',
    });
  } catch (error) {
    next(error);
  }
});

export default router;
