// ============================================
// Admin: Tenant Management Routes
// ============================================

import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { query, transaction } from '../../db/client.js';
import { createTenantSchema, updateTenantSchema, paginationSchema } from '@chatbot/shared';
import { authenticate, requireAdmin } from '../../middleware/auth.js';
import { logAudit } from '../../middleware/audit.js';
import { ValidationError, NotFoundError, ConflictError } from '../../utils/errors.js';

const router = Router();

// All admin routes require super_admin role
router.use(authenticate, requireAdmin);

// GET /api/admin/tenants — List all tenants
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, per_page, search, sort_by, sort_order } = paginationSchema.parse(req.query);
    const offset = (page - 1) * per_page;

    let whereClause = '';
    const params: unknown[] = [];

    if (search) {
      params.push(`%${search}%`);
      whereClause = `WHERE t.name ILIKE $${params.length} OR t.slug ILIKE $${params.length}`;
    }

    const validSortColumns = ['name', 'slug', 'status', 'created_at'];
    const sortCol = validSortColumns.includes(sort_by || '') ? sort_by : 'created_at';

    const countResult = await query(
      `SELECT COUNT(*) FROM tenants t ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const result = await query(
      `SELECT t.*,
        (SELECT COUNT(*) FROM sources s WHERE s.tenant_id = t.id) as source_count,
        (SELECT COUNT(*) FROM conversations c WHERE c.tenant_id = t.id) as conversation_count,
        (SELECT COUNT(*) FROM leads_orders lo WHERE lo.tenant_id = t.id) as lead_count
       FROM tenants t
       ${whereClause}
       ORDER BY t.${sortCol} ${sort_order}
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

// GET /api/admin/tenants/:id — Get tenant details
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await query(
      `SELECT t.*,
        (SELECT COUNT(*) FROM sources s WHERE s.tenant_id = t.id) as source_count,
        (SELECT COUNT(*) FROM conversations c WHERE c.tenant_id = t.id) as conversation_count,
        (SELECT COUNT(*) FROM leads_orders lo WHERE lo.tenant_id = t.id) as lead_count,
        (SELECT json_agg(json_build_object('id', u.id, 'email', u.email, 'role', u.role, 'status', u.status))
         FROM users u WHERE u.tenant_id = t.id) as users
       FROM tenants t
       WHERE t.id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('Tenant', req.params.id as string);
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// POST /api/admin/tenants — Create new tenant + client user
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = createTenantSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError('Invalid input', parsed.error.flatten());
    }

    const { name, slug, website_url, llm_provider, llm_model, embedding_provider, embedding_model } = parsed.data;

    // Check slug uniqueness
    const existing = await query('SELECT id FROM tenants WHERE slug = $1', [slug]);
    if (existing.rows.length > 0) {
      throw new ConflictError(`Tenant with slug '${slug}' already exists`);
    }

    // Extract client credentials from body
    const clientEmail = req.body.client_email;
    const clientPassword = req.body.client_password || uuidv4().slice(0, 12);

    if (!clientEmail) {
      throw new ValidationError('client_email is required');
    }

    // Check email uniqueness
    const emailExists = await query('SELECT id FROM users WHERE email = $1', [clientEmail]);
    if (emailExists.rows.length > 0) {
      throw new ConflictError(`User with email '${clientEmail}' already exists`);
    }

    const result = await transaction(async (client) => {
      // Create tenant
      const tenantResult = await client.query(
        `INSERT INTO tenants (name, slug, website_url, llm_provider, llm_model, embedding_provider, embedding_model)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [name, slug, website_url || null, llm_provider, llm_model, embedding_provider, embedding_model]
      );
      const tenant = tenantResult.rows[0];

      // Create client user
      const passwordHash = await bcrypt.hash(clientPassword, 12);
      const userResult = await client.query(
        `INSERT INTO users (tenant_id, email, password_hash, role)
         VALUES ($1, $2, $3, 'client_owner') RETURNING id, email, role`,
        [tenant.id, clientEmail, passwordHash]
      );

      // Assign free plan
      const planResult = await client.query(
        `SELECT id FROM billing_plans WHERE name = 'Free' AND is_active = true LIMIT 1`
      );
      if (planResult.rows.length > 0) {
        await client.query(
          `INSERT INTO billing_subscriptions (tenant_id, plan_id) VALUES ($1, $2)`,
          [tenant.id, planResult.rows[0].id]
        );
      }

      return {
        tenant,
        user: userResult.rows[0],
        generated_password: clientPassword,
      };
    });

    await logAudit(req, {
      action: 'tenant.create',
      target_type: 'tenant',
      target_id: result.tenant.id,
      details: { name, slug, client_email: clientEmail },
    });

    res.status(201).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/admin/tenants/:id — Update tenant
router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = updateTenantSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError('Invalid input', parsed.error.flatten());
    }

    const fields = parsed.data;
    const sets: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) {
        sets.push(`${key} = $${paramIndex}`);
        values.push(key === 'business_hours' ? JSON.stringify(value) : value);
        paramIndex++;
      }
    }

    if (sets.length === 0) {
      throw new ValidationError('No fields to update');
    }

    values.push(req.params.id);
    const result = await query(
      `UPDATE tenants SET ${sets.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('Tenant', req.params.id as string);
    }

    await logAudit(req, {
      action: 'tenant.update',
      target_type: 'tenant',
      target_id: req.params.id as string,
      details: fields,
    });

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/admin/tenants/:id — Soft delete tenant
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await query(
      `UPDATE tenants SET status = 'deleted' WHERE id = $1 RETURNING id, name, slug`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('Tenant', req.params.id as string);
    }

    await logAudit(req, {
      action: 'tenant.delete',
      target_type: 'tenant',
      target_id: req.params.id as string,
    });

    res.json({ success: true, data: result.rows[0], message: 'Tenant deleted' });
  } catch (error) {
    next(error);
  }
});

export default router;
