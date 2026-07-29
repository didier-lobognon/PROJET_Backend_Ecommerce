-- AlterEnum
ALTER TYPE "HomepageBannerSlot" ADD VALUE 'HERO_CARD_TOP';
ALTER TYPE "HomepageBannerSlot" ADD VALUE 'HERO_CARD_BOTTOM';

-- AlterTable
ALTER TABLE "homepage_banners" ADD COLUMN "price_amount" DECIMAL(12,2),
ADD COLUMN "original_price_amount" DECIMAL(12,2);
