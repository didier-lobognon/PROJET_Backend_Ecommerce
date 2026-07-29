import { WhatsappTemplate } from '../notifications.constants';

export const WHATSAPP_TEMPLATE_CONFIG: Record<
  WhatsappTemplate,
  { paramCount: number; language: string }
> = {
  order_confirmed: { paramCount: 2, language: 'fr' },
  order_preparing: { paramCount: 2, language: 'fr' },
  order_shipped: { paramCount: 2, language: 'fr' },
  order_delivered: { paramCount: 2, language: 'fr' },
  cart_abandoned: { paramCount: 1, language: 'fr' },
  marketing_promo: { paramCount: 1, language: 'fr' },
};
