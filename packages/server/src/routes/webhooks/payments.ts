// ============================================
// Payment Webhook Routes
// ============================================

import { Router, Request, Response, NextFunction } from 'express';
import { query } from '../../db/client.js';
import { RazorpayGateway } from '../../services/payments/providers/razorpay.js';
import { webhookLimiter } from '../../middleware/rateLimit.js';
import { logger } from '../../utils/logger.js';

const router = Router();
const razorpay = new RazorpayGateway();

// POST /api/webhooks/payments/razorpay — Razorpay webhook
router.post('/razorpay', webhookLimiter, async (req: Request, res: Response) => {
  try {
    const signature = req.headers['x-razorpay-signature'] as string;

    // Verify signature
    if (signature && !razorpay.verifyWebhook(req.body, signature)) {
      logger.warn('Invalid Razorpay webhook signature');
      return res.sendStatus(400);
    }

    const parsed = razorpay.parseWebhookPayment(req.body);

    if (!parsed.orderId) {
      logger.warn('Razorpay webhook missing order reference');
      return res.sendStatus(200);
    }

    // Update payment record
    await query(
      `UPDATE payments SET status = $1, gateway_payment_id = $2, webhook_payload = $3
       WHERE id = (SELECT p.id FROM payments p JOIN leads_orders lo ON lo.id = p.lead_order_id WHERE lo.id = $4 LIMIT 1)`,
      [parsed.status, parsed.gatewayPaymentId, JSON.stringify(req.body), parsed.orderId]
    );

    // Update lead/order payment status
    await query(
      `UPDATE leads_orders SET payment_status = $1 WHERE id = $2`,
      [parsed.status, parsed.orderId]
    );

    logger.info('Payment webhook processed', { orderId: parsed.orderId, status: parsed.status });
    res.sendStatus(200);
  } catch (error) {
    logger.error('Payment webhook error', { error: String(error) });
    res.sendStatus(500);
  }
});

export default router;
