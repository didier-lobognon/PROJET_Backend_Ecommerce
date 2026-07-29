-- CreateEnum
CREATE TYPE "InteractionChannel" AS ENUM ('EMAIL', 'WHATSAPP', 'ORDER', 'CONTACT', 'CAMPAIGN', 'SYSTEM');
CREATE TYPE "InteractionDirection" AS ENUM ('INBOUND', 'OUTBOUND');
CREATE TYPE "CampaignChannel" AS ENUM ('EMAIL', 'WHATSAPP');
CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'SENDING', 'COMPLETED', 'CANCELLED');
CREATE TYPE "CartAbandonmentStatus" AS ENUM ('SCHEDULED', 'SENT', 'CANCELLED', 'SKIPPED');

-- AlterTable
ALTER TABLE "users" ADD COLUMN "email_marketing_consent" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN "whatsapp_marketing_consent" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN "marketing_consent_at" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "marketing_consent_source" TEXT;

-- CreateTable
CREATE TABLE "customer_tags" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#E8920A',
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "customer_tags_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "user_customer_tags" (
    "user_id" TEXT NOT NULL,
    "tag_id" TEXT NOT NULL,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "user_customer_tags_pkey" PRIMARY KEY ("user_id","tag_id")
);

CREATE TABLE "customer_segments" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "rules" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "customer_segments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "customer_interactions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "channel" "InteractionChannel" NOT NULL,
    "direction" "InteractionDirection" NOT NULL,
    "type" TEXT NOT NULL,
    "subject" TEXT,
    "body" TEXT,
    "metadata" JSONB,
    "order_id" TEXT,
    "campaign_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "customer_interactions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "faq_scenarios" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "keywords" TEXT[],
    "response_text" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "faq_scenarios_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "whatsapp_inbound_events" (
    "id" TEXT NOT NULL,
    "external_message_id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "message_text" TEXT,
    "payload" JSONB NOT NULL,
    "faq_scenario_id" TEXT,
    "replied_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "whatsapp_inbound_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "cart_abandonment_reminders" (
    "id" TEXT NOT NULL,
    "cart_id" TEXT NOT NULL,
    "user_id" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "job_id" TEXT,
    "status" "CartAbandonmentStatus" NOT NULL DEFAULT 'SCHEDULED',
    "scheduled_for" TIMESTAMP(3) NOT NULL,
    "sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "cart_abandonment_reminders_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "marketing_campaigns" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "channel" "CampaignChannel" NOT NULL,
    "segment_id" TEXT,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "whatsapp_template" TEXT,
    "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "scheduled_at" TIMESTAMP(3),
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "total_recipients" INTEGER NOT NULL DEFAULT 0,
    "sent_count" INTEGER NOT NULL DEFAULT 0,
    "failed_count" INTEGER NOT NULL DEFAULT 0,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "marketing_campaigns_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "campaign_recipients" (
    "id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
    "error" TEXT,
    "sent_at" TIMESTAMP(3),
    CONSTRAINT "campaign_recipients_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "customer_tags_name_key" ON "customer_tags"("name");
CREATE UNIQUE INDEX "customer_tags_slug_key" ON "customer_tags"("slug");
CREATE INDEX "user_customer_tags_tag_id_idx" ON "user_customer_tags"("tag_id");
CREATE UNIQUE INDEX "customer_segments_name_key" ON "customer_segments"("name");
CREATE UNIQUE INDEX "customer_segments_slug_key" ON "customer_segments"("slug");
CREATE INDEX "customer_interactions_user_id_idx" ON "customer_interactions"("user_id");
CREATE INDEX "customer_interactions_phone_idx" ON "customer_interactions"("phone");
CREATE INDEX "customer_interactions_channel_idx" ON "customer_interactions"("channel");
CREATE INDEX "customer_interactions_created_at_idx" ON "customer_interactions"("created_at");
CREATE UNIQUE INDEX "whatsapp_inbound_events_external_message_id_key" ON "whatsapp_inbound_events"("external_message_id");
CREATE INDEX "whatsapp_inbound_events_phone_idx" ON "whatsapp_inbound_events"("phone");
CREATE INDEX "whatsapp_inbound_events_created_at_idx" ON "whatsapp_inbound_events"("created_at");
CREATE INDEX "cart_abandonment_reminders_cart_id_idx" ON "cart_abandonment_reminders"("cart_id");
CREATE INDEX "cart_abandonment_reminders_status_idx" ON "cart_abandonment_reminders"("status");
CREATE INDEX "cart_abandonment_reminders_scheduled_for_idx" ON "cart_abandonment_reminders"("scheduled_for");
CREATE INDEX "marketing_campaigns_status_idx" ON "marketing_campaigns"("status");
CREATE INDEX "marketing_campaigns_scheduled_at_idx" ON "marketing_campaigns"("scheduled_at");
CREATE UNIQUE INDEX "campaign_recipients_campaign_id_user_id_key" ON "campaign_recipients"("campaign_id", "user_id");
CREATE INDEX "campaign_recipients_campaign_id_idx" ON "campaign_recipients"("campaign_id");
CREATE INDEX "campaign_recipients_user_id_idx" ON "campaign_recipients"("user_id");

-- AddForeignKey
ALTER TABLE "user_customer_tags" ADD CONSTRAINT "user_customer_tags_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_customer_tags" ADD CONSTRAINT "user_customer_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "customer_tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "customer_interactions" ADD CONSTRAINT "customer_interactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "customer_interactions" ADD CONSTRAINT "customer_interactions_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "customer_interactions" ADD CONSTRAINT "customer_interactions_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "marketing_campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "cart_abandonment_reminders" ADD CONSTRAINT "cart_abandonment_reminders_cart_id_fkey" FOREIGN KEY ("cart_id") REFERENCES "carts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "marketing_campaigns" ADD CONSTRAINT "marketing_campaigns_segment_id_fkey" FOREIGN KEY ("segment_id") REFERENCES "customer_segments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "campaign_recipients" ADD CONSTRAINT "campaign_recipients_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "marketing_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "campaign_recipients" ADD CONSTRAINT "campaign_recipients_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
