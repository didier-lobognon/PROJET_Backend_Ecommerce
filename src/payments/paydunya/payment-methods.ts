export enum MobileMoneyMethod {
  WAVE = 'wave',
  ORANGE = 'orange',
  MTN = 'mtn',
  MOOV = 'moov',
}

export const CI_PAYMENT_METHODS = [
  {
    id: MobileMoneyMethod.WAVE,
    label: 'Wave',
    description: 'Paiement via l\'application Wave',
    fields: ['fullName', 'phone', 'email'] as const,
  },
  {
    id: MobileMoneyMethod.ORANGE,
    label: 'Orange Money',
    description: 'Code OTP requis (#144*82# → option 2)',
    fields: ['fullName', 'phone', 'email', 'otp'] as const,
  },
  {
    id: MobileMoneyMethod.MTN,
    label: 'MTN Mobile Money',
    description: 'Validation sur votre téléphone MTN',
    fields: ['fullName', 'phone', 'email'] as const,
  },
  {
    id: MobileMoneyMethod.MOOV,
    label: 'Moov Money',
    description: 'Validation par code secret sur votre téléphone',
    fields: ['fullName', 'phone', 'email'] as const,
  },
] as const;
