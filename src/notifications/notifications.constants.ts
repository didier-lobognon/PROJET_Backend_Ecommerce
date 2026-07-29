export const EMAIL_QUEUE = 'email';
export const WHATSAPP_QUEUE = 'whatsapp';
export const CART_ABANDONMENT_QUEUE = 'cart-abandonment';
export const CAMPAIGN_QUEUE = 'campaigns';

export const DEFAULT_JOB_OPTIONS = {
  attempts: 3,
  backoff: { type: 'exponential' as const, delay: 2000 },
  removeOnComplete: 100,
  removeOnFail: 500,
};

export type EmailTemplate =
  | 'order-confirmed'
  | 'order-preparing'
  | 'order-shipped'
  | 'order-delivered'
  | 'password-reset'
  | 'email-verification'
  | 'reservation-received'
  | 'reservation-approved'
  | 'reservation-rejected'
  | 'reservation-delivered';

export type WhatsappTemplate =
  | 'order_confirmed'
  | 'order_preparing'
  | 'order_shipped'
  | 'order_delivered'
  | 'cart_abandoned'
  | 'marketing_promo';

export interface EmailJobData {
  logId: string;
  template: EmailTemplate;
  to: string;
  subject: string;
  context: Record<string, unknown>;
}

export interface WhatsappJobData {
  logId: string;
  template?: WhatsappTemplate;
  phone: string;
  params?: string[];
  text?: string;
  fallbackEmail?: {
    template: EmailTemplate;
    subject: string;
    context: Record<string, unknown>;
    to: string;
    userId?: string | null;
  };
}

export interface CartAbandonmentJobData {
  reminderId: string;
}

export const ORDER_STATUS_EMAIL: Partial<
  Record<string, { template: EmailTemplate; subject: string }>
> = {
  CONFIRMED: { template: 'order-confirmed', subject: 'Commande confirmée — Kaniê' },
  PREPARING: { template: 'order-preparing', subject: 'Commande en préparation — Kaniê' },
  SHIPPED: { template: 'order-shipped', subject: 'Commande expédiée — Kaniê' },
  DELIVERED: { template: 'order-delivered', subject: 'Commande livrée — Kaniê' },
};

export const ORDER_STATUS_WHATSAPP: Partial<
  Record<string, WhatsappTemplate>
> = {
  CONFIRMED: 'order_confirmed',
  PREPARING: 'order_preparing',
  SHIPPED: 'order_shipped',
  DELIVERED: 'order_delivered',
};

export const RESERVATION_STATUS_EMAIL: Record<
  string,
  { template: EmailTemplate; subject: string }
> = {
  PENDING: {
    template: 'reservation-received',
    subject: 'Demande de réservation reçue — Kaniê',
  },
  APPROVED: {
    template: 'reservation-approved',
    subject: 'Réservation approuvée — Kaniê',
  },
  REJECTED: {
    template: 'reservation-rejected',
    subject: 'Réservation non disponible — Kaniê',
  },
  DELIVERED: {
    template: 'reservation-delivered',
    subject: 'Article réservé livré — Kaniê',
  },
};
