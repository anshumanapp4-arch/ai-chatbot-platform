// ============================================
// Client: Leads & Orders Routes
// ============================================

import { Router, Request, Response, NextFunction } from 'express';
import { query } from '../../db/client.js';
import { authenticate } from '../../middleware/auth.js';
import { tenantScope } from '../../middleware/tenantScope.js';
import { paginationSchema, updateLeadOrderSchema } from '@chatbot/shared';
import { NotFoundError, ValidationError } from '../../utils/errors.js';
import { decryptPII } from '../../utils/encryption.js';
import { RazorpayGateway } from '../../services/payments/providers/razorpay.js';

const router = Router();
router.use(authenticate, tenantScope);

// GET /api/client/leads — List leads/orders
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, per_page, search, sort_by, sort_order } = paginationSchema.parse(req.query);
    const offset = (page - 1) * per_page;
    const status = req.query.status as string;
    const type = req.query.type as string;
    const channel = req.query.channel as string;

    let whereClause = 'WHERE lo.tenant_id = $1';
    const params: unknown[] = [req.tenantId];

    if (status) {
      params.push(status);
      whereClause += ` AND lo.status = $${params.length}`;
    }
    if (type) {
      params.push(type);
      whereClause += ` AND lo.type = $${params.length}`;
    }
    if (channel) {
      params.push(channel);
      whereClause += ` AND lo.source_channel = $${params.length}`;
    }

    const countResult = await query(
      `SELECT COUNT(*) FROM leads_orders lo ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const validSortColumns = ['created_at', 'status', 'type', 'payment_status'];
    const sortCol = validSortColumns.includes(sort_by || '') ? sort_by : 'created_at';

    const result = await query(
      `SELECT lo.* FROM leads_orders lo
       ${whereClause}
       ORDER BY lo.${sortCol} ${sort_order}
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, per_page, offset]
    );

    // Decrypt PII fields for display
    const rows = result.rows.map(row => ({
      ...row,
      customer_name: row.customer_name ? decryptPII(row.customer_name) : null,
      customer_phone: row.customer_phone ? decryptPII(row.customer_phone) : null,
      customer_email: row.customer_email ? decryptPII(row.customer_email) : null,
    }));

    res.json({
      success: true,
      data: rows,
      total,
      page,
      per_page,
      total_pages: Math.ceil(total / per_page),
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/client/leads/:id — Get lead/order detail
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await query(
      'SELECT * FROM leads_orders WHERE id = $1 AND tenant_id = $2',
      [req.params.id, req.tenantId]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('LeadOrder', req.params.id as string);
    }

    const row = result.rows[0];
    row.customer_name = row.customer_name ? decryptPII(row.customer_name) : null;
    row.customer_phone = row.customer_phone ? decryptPII(row.customer_phone) : null;
    row.customer_email = row.customer_email ? decryptPII(row.customer_email) : null;

    res.json({ success: true, data: row });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/client/leads/:id — Update lead/order status
router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = updateLeadOrderSchema.safeParse(req.body);
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
        values.push(value);
        i++;
      }
    }

    if (sets.length === 0) {
      throw new ValidationError('No fields to update');
    }

    values.push(req.params.id, req.tenantId);
    const result = await query(
      `UPDATE leads_orders SET ${sets.join(', ')} WHERE id = $${i} AND tenant_id = $${i + 1} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('LeadOrder', req.params.id as string);
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// POST /api/client/leads/:id/payment-link — Generate a payment link
router.post('/:id/payment-link', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { amount, currency } = req.body;
    if (!amount || amount <= 0) {
      throw new ValidationError('Amount must be greater than zero');
    }

    // 1. Fetch lead details
    const leadResult = await query(
      'SELECT * FROM leads_orders WHERE id = $1 AND tenant_id = $2',
      [req.params.id, req.tenantId]
    );

    if (leadResult.rows.length === 0) {
      throw new NotFoundError('LeadOrder', req.params.id as string);
    }

    const lead = leadResult.rows[0];

    // Decrypt PII details for Razorpay customer object
    const customerName = lead.customer_name ? decryptPII(lead.customer_name) : undefined;
    const customerPhone = lead.customer_phone ? decryptPII(lead.customer_phone) : undefined;
    const customerEmail = lead.customer_email ? decryptPII(lead.customer_email) : undefined;

    // 2. Create Razorpay Payment Link (convert amount to paise)
    const gateway = new RazorpayGateway();
    const linkResult = await gateway.createPaymentLink({
      amount: Math.round(amount * 100),
      currency: currency || 'INR',
      description: `Payment for order reference ${lead.id}`,
      orderId: lead.id,
      customerName,
      customerPhone,
      customerEmail,
    });

    if (!linkResult.success) {
      throw new ValidationError('Failed to generate payment link with gateway');
    }

    // 3. Update database
    await query(
      `UPDATE leads_orders SET 
        payment_link = $1, 
        payment_amount = $2, 
        payment_currency = $3, 
        payment_status = 'pending'
       WHERE id = $4`,
      [linkResult.paymentLinkUrl, amount, currency || 'INR', lead.id]
    );

    // Insert into payments table
    await query(
      `INSERT INTO payments (tenant_id, lead_order_id, gateway, gateway_payment_id, amount, currency, status)
       VALUES ($1, $2, 'razorpay', $3, $4, $5, 'pending')`,
      [req.tenantId, lead.id, linkResult.paymentLinkId, amount, currency || 'INR']
    );

    res.json({
      success: true,
      data: {
        payment_link: linkResult.paymentLinkUrl,
        payment_status: 'pending',
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
