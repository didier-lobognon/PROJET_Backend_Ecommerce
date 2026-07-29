export const CART_SESSION_HEADER = 'x-cart-session';
export const GUEST_CART_PREFIX = 'cart:guest:';
export const GUEST_CART_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days
export const DEFAULT_SHIPPING_FEE = 2500; // FCFA

export const ORDER_STATUS_FLOW: Record<string, string> = {
  PENDING: 'En attente',
  CONFIRMED: 'Confirmée',
  PREPARING: 'En préparation',
  SHIPPED: 'Expédiée',
  DELIVERED: 'Livrée',
  CANCELLED: 'Annulée',
  REFUNDED: 'Remboursée',
};
