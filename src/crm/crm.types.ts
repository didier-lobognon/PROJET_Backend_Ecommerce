export interface SegmentRules {
  minOrderCount?: number;
  minTotalSpent?: number;
  inactiveDays?: number;
}

export interface LogInteractionInput {
  userId?: string | null;
  phone?: string | null;
  email?: string | null;
  channel: 'EMAIL' | 'WHATSAPP' | 'ORDER' | 'CONTACT' | 'CAMPAIGN' | 'SYSTEM';
  direction: 'INBOUND' | 'OUTBOUND';
  type: string;
  subject?: string;
  body?: string;
  metadata?: Record<string, unknown>;
  orderId?: string;
  campaignId?: string;
}
