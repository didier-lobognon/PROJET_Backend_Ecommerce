import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, timingSafeEqual } from 'crypto';
import {
  CreatePaydunyaInvoiceParams,
  PaydunyaConfirmResponse,
  PaydunyaCreateInvoiceResponse,
  PaydunyaSoftPayResponse,
  SoftPayMoovCiParams,
  SoftPayMtnCiParams,
  SoftPayOrangeCiParams,
  SoftPayWaveCiParams,
} from './paydunya.types';

@Injectable()
export class PaydunyaClient {
  private readonly logger = new Logger(PaydunyaClient.name);

  constructor(private readonly config: ConfigService) {}

  get isConfigured(): boolean {
    return Boolean(this.masterKey && this.privateKey && this.token);
  }

  private get masterKey(): string {
    return this.config.get<string>('PAYDUNYA_MASTER_KEY', '');
  }

  private get privateKey(): string {
    return this.config.get<string>('PAYDUNYA_PRIVATE_KEY', '');
  }

  private get token(): string {
    return this.config.get<string>('PAYDUNYA_TOKEN', '');
  }

  private get baseUrl(): string {
    const mode = this.config.get<string>('PAYDUNYA_MODE', 'test');
    return mode === 'live'
      ? 'https://app.paydunya.com/api/v1'
      : 'https://app.paydunya.com/sandbox-api/v1';
  }

  verifyWebhookHash(receivedHash: string): boolean {
    if (!this.masterKey || !receivedHash) return false;

    const expectedHash = createHash('sha512').update(this.masterKey).digest('hex');

    if (receivedHash.length !== expectedHash.length) return false;

    try {
      return timingSafeEqual(
        Buffer.from(receivedHash, 'utf8'),
        Buffer.from(expectedHash, 'utf8'),
      );
    } catch {
      return false;
    }
  }

  async createInvoice(params: CreatePaydunyaInvoiceParams): Promise<PaydunyaCreateInvoiceResponse> {
    const body = {
      invoice: {
        total_amount: params.totalAmount,
        description: params.description,
      },
      store: {
        name: 'Kaniê',
      },
      custom_data: params.customData,
      actions: params.actions,
    };

    const response = await this.request<PaydunyaCreateInvoiceResponse>(
      '/checkout-invoice/create',
      body,
    );

    if (response.response_code !== '00') {
      this.logger.warn(`PayDunya create invoice failed: ${response.response_code}`);
      throw new Error(response.response_text || 'Échec création facture PayDunya');
    }

    return response;
  }

  async confirmInvoice(invoiceToken: string): Promise<PaydunyaConfirmResponse> {
    return this.request<PaydunyaConfirmResponse>(
      `/checkout-invoice/confirm/${invoiceToken}`,
      undefined,
      'GET',
    );
  }

  async payWaveCi(params: SoftPayWaveCiParams): Promise<PaydunyaSoftPayResponse> {
    return this.softPay('/softpay/wave-ci', {
      wave_ci_fullName: params.fullName,
      wave_ci_email: params.email,
      wave_ci_phone: params.phone,
      wave_ci_payment_token: params.paymentToken,
    });
  }

  async payOrangeMoneyCi(params: SoftPayOrangeCiParams): Promise<PaydunyaSoftPayResponse> {
    return this.softPay('/softpay/orange-money-ci', {
      orange_money_ci_customer_fullname: params.fullName,
      orange_money_ci_email: params.email,
      orange_money_ci_phone_number: params.phone,
      orange_money_ci_otp: params.otp,
      payment_token: params.paymentToken,
    });
  }

  async payMtnCi(params: SoftPayMtnCiParams): Promise<PaydunyaSoftPayResponse> {
    return this.softPay('/softpay/mtn-ci', {
      mtn_ci_customer_fullname: params.fullName,
      mtn_ci_email: params.email,
      mtn_ci_phone_number: params.phone,
      mtn_ci_wallet_provider: 'MTNCI',
      payment_token: params.paymentToken,
    });
  }

  async payMoovCi(params: SoftPayMoovCiParams): Promise<PaydunyaSoftPayResponse> {
    return this.softPay('/softpay/moov-ci', {
      moov_ci_customer_fullname: params.fullName,
      moov_ci_email: params.email,
      moov_ci_phone_number: params.phone,
      payment_token: params.paymentToken,
    });
  }

  private async softPay(
    path: string,
    body: Record<string, string>,
  ): Promise<PaydunyaSoftPayResponse> {
    const response = await this.request<PaydunyaSoftPayResponse>(path, body);
    return response;
  }

  private async request<T>(
    path: string,
    body?: unknown,
    method: 'GET' | 'POST' = 'POST',
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;

    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'PAYDUNYA-MASTER-KEY': this.masterKey,
        'PAYDUNYA-PRIVATE-KEY': this.privateKey,
        'PAYDUNYA-TOKEN': this.token,
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });

    if (!response.ok) {
      const text = await response.text();
      this.logger.error(`PayDunya HTTP ${response.status}: ${text.slice(0, 200)}`);
      throw new Error(`Erreur PayDunya (${response.status})`);
    }

    return response.json() as Promise<T>;
  }
}
