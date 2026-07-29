import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WhatsappTemplate } from '../notifications.constants';
import { WHATSAPP_TEMPLATE_CONFIG } from './whatsapp.templates';

@Injectable()
export class WhatsappClient {
  private readonly logger = new Logger(WhatsappClient.name);
  private readonly apiVersion = 'v21.0';

  constructor(private readonly config: ConfigService) {}

  get isConfigured(): boolean {
    return Boolean(this.phoneNumberId && this.accessToken);
  }

  private get phoneNumberId(): string {
    return this.config.get<string>('WHATSAPP_PHONE_NUMBER_ID', '');
  }

  private get accessToken(): string {
    return this.config.get<string>('WHATSAPP_ACCESS_TOKEN', '');
  }

  formatPhone(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    if (digits.startsWith('225')) return digits;
    if (digits.startsWith('0')) return `225${digits.slice(1)}`;
    return `225${digits}`;
  }

  async sendTemplate(
    phone: string,
    template: WhatsappTemplate,
    params: string[],
  ): Promise<void> {
    if (!this.isConfigured) {
      throw new Error('WhatsApp non configuré');
    }

    const config = WHATSAPP_TEMPLATE_CONFIG[template];
    const url = `https://graph.facebook.com/${this.apiVersion}/${this.phoneNumberId}/messages`;

    const body = {
      messaging_product: 'whatsapp',
      to: this.formatPhone(phone),
      type: 'template',
      template: {
        name: template,
        language: { code: config.language },
        components: [
          {
            type: 'body',
            parameters: params.slice(0, config.paramCount).map((text) => ({
              type: 'text',
              text,
            })),
          },
        ],
      },
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      this.logger.error(`WhatsApp API error ${response.status}: ${text.slice(0, 200)}`);
      throw new Error(`WhatsApp API (${response.status})`);
    }

    this.logger.log(`WhatsApp sent: template=${template} to=***${phone.slice(-4)}`);
  }

  async sendText(phone: string, text: string): Promise<void> {
    if (!this.isConfigured) {
      throw new Error('WhatsApp non configuré');
    }

    const url = `https://graph.facebook.com/${this.apiVersion}/${this.phoneNumberId}/messages`;
    const body = {
      messaging_product: 'whatsapp',
      to: this.formatPhone(phone),
      type: 'text',
      text: { body: text.slice(0, 4096) },
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const responseText = await response.text();
      this.logger.error(`WhatsApp text error ${response.status}: ${responseText.slice(0, 200)}`);
      throw new Error(`WhatsApp API (${response.status})`);
    }

    this.logger.log(`WhatsApp text sent to=***${phone.slice(-4)}`);
  }
}
