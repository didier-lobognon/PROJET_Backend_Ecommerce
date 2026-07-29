export interface MessageTemplateUser {
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
}

export interface MessageTemplateExtras {
  cartItems?: string;
}

export function renderMessageTemplate(
  template: string,
  user: MessageTemplateUser,
  extras: MessageTemplateExtras = {},
): string {
  const firstName = user.firstName?.trim() || 'Client';
  const lastName = user.lastName?.trim() || '';
  const fullName =
    [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || user.email;

  return template
    .replace(/\{\{firstName\}\}/g, firstName)
    .replace(/\{\{lastName\}\}/g, lastName)
    .replace(/\{\{fullName\}\}/g, fullName)
    .replace(/\{\{email\}\}/g, user.email)
    .replace(/\{\{phone\}\}/g, user.phone ?? '')
    .replace(/\{\{cartItems\}\}/g, extras.cartItems ?? '');
}

export function formatEmailHtml(text: string): string {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  return escaped
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br>');
}

export function formatWhatsappText(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '*$1*')
    .replace(/\*(.+?)\*/g, '_$1_');
}

export function formatCartItemsList(
  items: { productName: string; quantity: number; unitPrice: number }[],
): string {
  return items
    .map((item) => `• ${item.productName} × ${item.quantity} — ${item.unitPrice} FCFA`)
    .join('\n');
}
