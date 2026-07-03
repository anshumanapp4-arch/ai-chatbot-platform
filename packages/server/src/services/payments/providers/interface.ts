// ============================================
// Payment Gateway Interface
// ============================================

export interface PaymentGatewayInterface {
  /**
   * Create a payment link for an order
   */
  createPaymentLink(options: CreatePaymentLinkOptions): Promise<PaymentLinkResult>;

  /**
   * Verify a payment webhook
   */
  verifyWebhook(payload: any, signature: string): boolean;

  /**
   * Parse payment status from webhook
   */
  parseWebhookPayment(payload: any): ParsedPayment;
}

export interface CreatePaymentLinkOptions {
  amount: number;       // In smallest currency unit (paise for INR)
  currency: string;     // e.g. 'INR'
  description: string;
  orderId: string;      // Internal reference
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  callbackUrl?: string;
}

export interface PaymentLinkResult {
  paymentLinkId: string;
  paymentLinkUrl: string;
  success: boolean;
}

export interface ParsedPayment {
  gatewayPaymentId: string;
  orderId: string;
  status: 'paid' | 'failed' | 'refunded';
  amount: number;
  currency: string;
}
