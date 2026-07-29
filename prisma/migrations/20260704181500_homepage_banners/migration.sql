-- CreateEnum
CREATE TYPE "HomepageBannerSlot" AS ENUM ('MAIN', 'GRID_LEFT', 'GRID_RIGHT');
CREATE TYPE "HomepageBannerButtonStyle" AS ENUM ('PRIMARY', 'TEAL', 'ORANGE');
CREATE TYPE "HomepageBannerTextAlign" AS ENUM ('LEFT', 'RIGHT');
CREATE TYPE "HomepageBannerImageSide" AS ENUM ('LEFT', 'RIGHT');

-- CreateTable
CREATE TABLE "homepage_banners" (
    "id" TEXT NOT NULL,
    "slot" "HomepageBannerSlot" NOT NULL,
    "tagline" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "highlight_text" TEXT,
    "image_url" TEXT,
    "link_url" TEXT NOT NULL,
    "button_label" TEXT NOT NULL,
    "bg_color" TEXT,
    "button_style" "HomepageBannerButtonStyle" NOT NULL DEFAULT 'PRIMARY',
    "text_align" "HomepageBannerTextAlign" NOT NULL DEFAULT 'LEFT',
    "image_side" "HomepageBannerImageSide" NOT NULL DEFAULT 'RIGHT',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "homepage_banners_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "homepage_banners_slot_key" ON "homepage_banners"("slot");
