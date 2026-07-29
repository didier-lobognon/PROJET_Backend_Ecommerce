-- Drop per-client tag assignments (tags now belong to segments)
DROP TABLE IF EXISTS "user_customer_tags";

-- Tag on segment configuration
ALTER TABLE "customer_segments" ADD COLUMN "tag_id" TEXT;

-- Manual client-to-segment membership
CREATE TABLE "user_customer_segments" (
    "user_id" TEXT NOT NULL,
    "segment_id" TEXT NOT NULL,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_customer_segments_pkey" PRIMARY KEY ("user_id","segment_id")
);

CREATE INDEX "user_customer_segments_segment_id_idx" ON "user_customer_segments"("segment_id");
CREATE INDEX "customer_segments_tag_id_idx" ON "customer_segments"("tag_id");

ALTER TABLE "customer_segments" ADD CONSTRAINT "customer_segments_tag_id_fkey"
    FOREIGN KEY ("tag_id") REFERENCES "customer_tags"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "user_customer_segments" ADD CONSTRAINT "user_customer_segments_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_customer_segments" ADD CONSTRAINT "user_customer_segments_segment_id_fkey"
    FOREIGN KEY ("segment_id") REFERENCES "customer_segments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Migrate legacy tagIds from rules JSON to segment.tag_id (first tag only)
UPDATE "customer_segments"
SET "tag_id" = (rules->'tagIds'->>0)::TEXT
WHERE rules ? 'tagIds'
  AND jsonb_array_length(rules->'tagIds') > 0
  AND (rules->'tagIds'->>0) IS NOT NULL;
