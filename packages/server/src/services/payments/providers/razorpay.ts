// ============================================
// Razorpay Payment Gateway Adapter
// ============================================

import crypto from 'crypto';
import { config } from '../../../config/index.js';
import type { PaymentGatewayInterface, CreatePaymentLinkOptions, PaymentLinkResult, ParsedPayment } from './interface.js';
import { logger } from '../../../utils/logger.js';

const RAZORPAY_API_URL = 'https://api.razorpay.com/v1';

export class RazorpayGateway implements PaymentGatewayInterface {
  private keyId: string;
  private keySecret: string;

  constructor() {
    this.keyId = config.razorpay.keyId;
    this.keySecret = config.razorpay.keySecret;
  }

  private getAuthHeader(): string {
    return 'Basic ' + Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64');
  }

  async createPaymentLink(options: CreatePaymentLinkOptions): Promise<PaymentLinkResult> {
    try {
      const response = await fetch(`${RAZORPAY_API_URL}/payment_links`, {
        method: 'POST',
        headers: {
          'Authorization': this.getAuthHeader(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: options.amount, // Amount in paise
          currency: options.currency || 'INR',
          description: options.description,
          reference_id: options.orderId,
          customer: {
            name: options.customerName,
            email: options.customerEmail,
            contact: options.customerPhone,
          },
          callback_url: options.callbackUrl,
          callback_method: 'get',
          notify: {
            sms: !!options.customerPhone,
            email: !!options.customerEmail,
          },
        }),
      });

      const data = await response.json() as any;

      if (!response.ok) {
        logger.error('Razorpay API error', { status: response.status, data });
        return { paymentLinkId: '', paymentLinkUrl: '', success: false };
      }

      return {
        paymentLinkId: data.id,
        paymentLinkUrl: data.short_url,
        success: true,
      };
    } catch (error) {
      logger.error('Razorpay createPaymentLink failed', { error: String(error) });
      return { paymentLinkId: '', paymentLinkUrl: '', success: false };
    }
  }

  verifyWebhook(payload: any, signature: string): boolean {
    const expectedSig = crypto
      .createHmac('sha256', this.keySecret)
      .update(JSON.stringify(payload))
      .digest('hex');

    try {
      return crypto.timingSafeEqual(
        Buffer.from(expectedSig),
        Buffer.from(signature)
      );
    } catch {
      return false;
    }
  }

  parseWebhookPayment(payload: any): ParsedPayment {
    const event = payload.event;
    const entity = payload.payload?.payment_link?.entity || payload.payload?.payment?.entity;

    let status: 'paid' | 'failed' | 'refunded' = 'failed';
    if (event === 'payment_link.paid' || event === 'payment.captured') {
      status = 'paid';
    } else if (event === 'refund.created') {
      status = 'refunded';
    }

    return {
      gatewayPaymentId: entity?.id || '',
      orderId: entity?.reference_id || entity?.notes?.order_id || '',
      status,
      amount: (entity?.amount || 0) / 100, // Convert paise to rupees
      currency: entity?.currency || 'INR',
    };
  }
}
