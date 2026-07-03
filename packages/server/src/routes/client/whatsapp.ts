// ============================================
// Client: WhatsApp Connection Routes
// ============================================

import { Router, Request, Response, NextFunction } from 'express';
import { query } from '../../db/client.js';
import { authenticate } from '../../middleware/auth.js';
import { tenantScope } from '../../middleware/tenantScope.js';
import { encryptPII } from '../../utils/encryption.js';
import { ValidationError, NotFoundError } from '../../utils/errors.js';
import { logAudit } from '../../middleware/audit.js';

const router = Router();
router.use(authenticate, tenantScope);

// GET /api/client/whatsapp — Get WhatsApp connection details
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await query(
      `SELECT id, provider, phone_number, phone_number_id, waba_id, status, health_checked_at
       FROM whatsapp_connections WHERE tenant_id = $1`,
      [req.tenantId]
    );

    res.json({
      success: true,
      data: result.rows[0] || null,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/client/whatsapp — Create/update WhatsApp connection
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { phone_number, phone_number_id, waba_id, access_token } = req.body;

    if (!phone_number || !phone_number_id || !waba_id || !access_token) {
      throw new ValidationError('All fields are required');
    }

    const encryptedToken = encryptPII(access_token);

    // Upsert connection
    const result = await query(
      `INSERT INTO whatsapp_connections (tenant_id, provider, phone_number, phone_number_id, waba_id, access_token_encrypted, status)
       VALUES ($1, 'meta_cloud_api', $2, $3, $4, $5, 'connected')
       ON CONFLICT (tenant_id) DO UPDATE SET
         phone_number = EXCLUDED.phone_number,
         phone_number_id = EXCLUDED.phone_number_id,
         waba_id = EXCLUDED.waba_id,
         access_token_encrypted = EXCLUDED.access_token_encrypted,
         status = 'connected',
         health_checked_at = NOW()
       RETURNING id, provider, phone_number, phone_number_id, waba_id, status`,
      [req.tenantId, phone_number, phone_number_id, waba_id, encryptedToken]
    );

    await logAudit(req, {
      action: 'whatsapp.connect',
      target_type: 'whatsapp_connection',
      target_id: result.rows[0].id,
      details: { phone_number, phone_number_id },
    });

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/client/whatsapp — Disconnect WhatsApp
router.delete('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await query(
      `DELETE FROM whatsapp_connections WHERE tenant_id = $1 RETURNING id`,
      [req.tenantId]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('WhatsApp connection not found');
    }

    await logAudit(req, {
      action: 'whatsapp.disconnect',
      target_type: 'whatsapp_connection',
      target_id: result.rows[0].id,
    });

    res.json({
      success: true,
      message: 'WhatsApp disconnected successfully',
    });
  } catch (error) {
    next(error);
  }
});

export default router;
