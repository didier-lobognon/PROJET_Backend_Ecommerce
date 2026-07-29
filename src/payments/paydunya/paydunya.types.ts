export interface PaydunyaInvoiceActions {
  callback_url: string;
  return_url: string;
  cancel_url: string;
}

export interface PaydunyaCustomData {
  order_id: string;
  order_number: string;
}

export interface CreatePaydunyaInvoiceParams {
  totalAmount: number;
  description: string;
  customData: PaydunyaCustomData;
  actions: PaydunyaInvoiceActions;
}

export interface PaydunyaCreateInvoiceResponse {
  response_code: string;
  response_text: string;
  description?: string;
  token: string;
}

export interface PaydunyaWebhookPayload {
  response_code?: string;
  hash: string;
  status: 'completed' | 'pending' | 'cancelled' | 'failed';
  total_amount?: number;
  invoice?: {
    token?: string;
  };
  custom_data?: PaydunyaCustomData;
  fail_reason?: string;
}

export interface PaydunyaConfirmResponse {
  response_code: string;
  status: 'completed' | 'pending' | 'cancelled' | 'failed';
  total_amount?: number;
  custom_data?: PaydunyaCustomData;
  invoice?: {
    token?: string;
  };
}

export interface PaydunyaSoftPayResponse {
  success: boolean;
  message: string;
  url?: string;
  fees?: number;
  currency?: string;
}

export interface SoftPayWaveCiParams {
  fullName: string;
  email: string;
  phone: string;
  paymentToken: string;
}

export interface SoftPayOrangeCiParams {
  fullName: string;
  email: string;
  phone: string;
  otp: string;
  paymentToken: string;
}

export interface SoftPayMtnCiParams {
  fullName: string;
  email: string;
  phone: string;
  paymentToken: string;
}

export interface SoftPayMoovCiParams {
  fullName: string;
  email: string;
  phone: string;
  paymentToken: string;
}
