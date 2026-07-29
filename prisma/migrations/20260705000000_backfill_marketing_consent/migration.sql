-- Existing users: grant marketing consent (pre-RGPD checkbox rollout)
UPDATE "users"
SET
  "email_marketing_consent" = true,
  "whatsapp_marketing_consent" = true,
  "marketing_consent_at" = COALESCE("marketing_consent_at", CURRENT_TIMESTAMP),
  "marketing_consent_source" = COALESCE("marketing_consent_source", 'migration_legacy')
WHERE "email_marketing_consent" = false OR "whatsapp_marketing_consent" = false;
