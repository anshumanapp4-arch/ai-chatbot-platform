// ============================================
// Meta Cloud API WhatsApp Adapter
// ============================================

import crypto from 'crypto';
import type { WhatsAppProviderInterface, WhatsAppSendResult, WhatsAppIncomingMessage } from './interface.js';
import { logger } from '../../../utils/logger.js';

const META_API_URL = 'https://graph.facebook.com/v21.0';

export class MetaCloudApiProvider implements WhatsAppProviderInterface {

  async sendTextMessage(
    phoneNumberId: string,
    to: string,
    text: string,
    accessToken: string
  ): Promise<WhatsAppSendResult> {
    try {
      const response = await fetch(`${META_API_URL}/${phoneNumberId}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to,
          type: 'text',
          text: { preview_url: false, body: text },
        }),
      });

      const data = await response.json() as any;

      if (!response.ok) {
        logger.error('Meta API error', { status: response.status, data });
        return { messageId: '', success: false };
      }

      return {
        messageId: data.messages?.[0]?.id || '',
        success: true,
      };
    } catch (error) {
      logger.error('Failed to send WhatsApp message', { error: String(error) });
      return { messageId: '', success: false };
    }
  }

  async sendTemplateMessage(
    phoneNumberId: string,
    to: string,
    templateName: string,
    languageCode: string,
    components: any[],
    accessToken: string
  ): Promise<WhatsAppSendResult> {
    try {
      const response = await fetch(`${META_API_URL}/${phoneNumberId}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to,
          type: 'template',
          template: {
            name: templateName,
            language: { code: languageCode },
            components,
          },
        }),
      });

      const data = await response.json() as any;
      return {
        messageId: data.messages?.[0]?.id || '',
        success: response.ok,
      };
    } catch (error) {
      logger.error('Failed to send template message', { error: String(error) });
      return { messageId: '', success: false };
    }
  }

  verifyWebhookSignature(payload: Buffer, signature: string, appSecret: string): boolean {
    const hmac = crypto.createHmac('sha256', appSecret);
    const expectedSig = 'sha256=' + hmac.update(payload).digest('hex');

    try {
      return crypto.timingSafeEqual(
        Buffer.from(expectedSig, 'utf8'),
        Buffer.from(signature, 'utf8')
      );
    } catch {
      return false;
    }
  }

  parseWebhookPayload(payload: any): WhatsAppIncomingMessage[] {
    const messages: WhatsAppIncomingMessage[] = [];

    if (!payload?.entry) return messages;

    for (const entry of payload.entry) {
      for (const change of entry.changes || []) {
        const value = change.value;
        if (!value?.messages) continue;

        const phoneNumberId = value.metadata?.phone_number_id || '';

        for (const msg of value.messages) {
          const parsed: WhatsAppIncomingMessage = {
            messageId: msg.id,
            from: msg.from,
            timestamp: msg.timestamp,
            type: msg.type || 'text',
            phoneNumberId,
          };

          switch (msg.type) {
            case 'text':
              parsed.text = msg.text?.body || '';
              break;
            case 'image':
              parsed.mediaId = msg.image?.id;
              parsed.caption = msg.image?.caption;
              break;
            case 'audio':
              parsed.mediaId = msg.audio?.id;
              break;
            case 'video':
              parsed.mediaId = msg.video?.id;
              parsed.caption = msg.video?.caption;
              break;
            case 'document':
              parsed.mediaId = msg.document?.id;
              parsed.caption = msg.document?.caption;
              break;
          }

          messages.push(parsed);
        }
      }
    }

    return messages;
  }
}
