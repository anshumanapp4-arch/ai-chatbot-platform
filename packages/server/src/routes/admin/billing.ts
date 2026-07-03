// ============================================
// Admin: Usage & Billing Routes
// ============================================

import { Router, Request, Response, NextFunction } from 'express';
import { query } from '../../db/client.js';
import { authenticate, requireAdmin } from '../../middleware/auth.js';
import { createBillingPlanSchema, paginationSchema } from '@chatbot/shared';
import { ValidationError, NotFoundError } from '../../utils/errors.js';
import { logAudit } from '../../middleware/audit.js';

const router = Router();
router.use(authenticate, requireAdmin);

// GET /api/admin/usage — Global usage overview
router.get('/usage', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    // Current month usage per tenant
    const currentMonth = new Date().toISOString().slice(0, 7) + '-01';

    const result = await query(
      `SELECT 
        t.id as tenant_id, t.name as tenant_name, t.slug,
        COALESCE(u.messages_sent, 0) as messages_sent,
        COALESCE(u.llm_tokens_input, 0) as llm_tokens_input,
        COALESCE(u.llm_tokens_output, 0) as llm_tokens_output,
        COALESCE(u.llm_cost_usd, 0) as llm_cost_usd,
        bp.name as plan_name,
        bp.message_limit,
        bp.price as plan_price
       FROM tenants t
       LEFT JOIN usage_records u ON u.tenant_id = t.id AND u.period = $1
       LEFT JOIN billing_subscriptions bs ON bs.tenant_id = t.id AND bs.status = 'active'
       LEFT JOIN billing_plans bp ON bp.id = bs.plan_id
       WHERE t.status = 'active'
       ORDER BY COALESCE(u.llm_cost_usd, 0) DESC`,
      [currentMonth]
    );

    // Totals
    const totals = result.rows.reduce(
      (acc, row) => ({
        total_messages: acc.total_messages + parseInt(row.messages_sent),
        total_cost_usd: acc.total_cost_usd + parseFloat(row.llm_cost_usd),
        total_revenue: acc.total_revenue + parseFloat(row.plan_price || 0),
      }),
      { total_messages: 0, total_cost_usd: 0, total_revenue: 0 }
    );

    res.json({
      success: true,
      data: {
        tenants: result.rows,
        totals: {
          ...totals,
          margin: totals.total_revenue - totals.total_cost_usd,
        },
        period: currentMonth,
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/admin/billing/plans — List billing plans
router.get('/plans', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await query('SELECT * FROM billing_plans ORDER BY price ASC');
    res.json({ success: true, data: result.rows });
  } catch (error) {
    next(error);
  }
});

// POST /api/admin/billing/plans — Create billing plan
router.post('/plans', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = createBillingPlanSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError('Invalid input', parsed.error.flatten());
    }

    const { name, message_limit, price, currency, overage_rate, features } = parsed.data;

    const result = await query(
      `INSERT INTO billing_plans (name, message_limit, price, currency, overage_rate, features)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [name, message_limit, price, currency, overage_rate, JSON.stringify(features)]
    );

    await logAudit(req, {
      action: 'billing_plan.create',
      target_type: 'billing_plan',
      target_id: result.rows[0].id,
      details: parsed.data,
    });

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/admin/billing/plans/:id — Update billing plan
router.patch('/plans/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = createBillingPlanSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError('Invalid input', parsed.error.flatten());
    }

    const fields = parsed.data;
    const sets: string[] = [];
    const values: unknown[] = [];
    let i = 1;

    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) {
        sets.push(`${key} = $${i}`);
        values.push(key === 'features' ? JSON.stringify(value) : value);
        i++;
      }
    }

    if (sets.length === 0) {
      throw new ValidationError('No fields to update');
    }

    values.push(req.params.id);
    const result = await query(
      `UPDATE billing_plans SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('BillingPlan', req.params.id as string);
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

export default router;
