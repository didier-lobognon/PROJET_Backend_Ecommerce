-- AlterTable
ALTER TABLE "promotions" ADD COLUMN "tagline" TEXT;
ALTER TABLE "promotions" ADD COLUMN "show_on_homepage" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "promotions_show_on_homepage_idx" ON "promotions"("show_on_homepage");
