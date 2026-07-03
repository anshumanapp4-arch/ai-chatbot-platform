// ============================================
// WhatsApp Provider Interface
// ============================================

export interface WhatsAppProviderInterface {
  /**
   * Send a text message to a phone number
   */
  sendTextMessage(phoneNumberId: string, to: string, text: string, accessToken: string): Promise<WhatsAppSendResult>;

  /**
   * Send a template message
   */
  sendTemplateMessage(
    phoneNumberId: string,
    to: string,
    templateName: string,
    languageCode: string,
    components: any[],
    accessToken: string
  ): Promise<WhatsAppSendResult>;

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(payload: Buffer, signature: string, appSecret: string): boolean;

  /**
   * Parse incoming webhook payload into normalized messages
   */
  parseWebhookPayload(payload: any): WhatsAppIncomingMessage[];
}

export interface WhatsAppSendResult {
  messageId: string;
  success: boolean;
}

export interface WhatsAppIncomingMessage {
  messageId: string;
  from: string;  // Phone number
  timestamp: string;
  type: 'text' | 'image' | 'audio' | 'video' | 'document' | 'reaction';
  text?: string;
  mediaId?: string;
  caption?: string;
  phoneNumberId: string;  // Which business number received it
}
