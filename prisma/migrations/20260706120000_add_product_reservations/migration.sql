-- CreateEnum
CREATE TYPE "ReservationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'DELIVERED');

-- CreateTable
CREATE TABLE "product_reservations" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "product_name" TEXT NOT NULL,
    "search_query" TEXT,
    "description" TEXT,
    "estimated_budget" DECIMAL(12,2),
    "full_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "status" "ReservationStatus" NOT NULL DEFAULT 'PENDING',
    "admin_note" TEXT,
    "offered_discount" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_reservations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "product_reservations_status_idx" ON "product_reservations"("status");

-- CreateIndex
CREATE INDEX "product_reservations_user_id_idx" ON "product_reservations"("user_id");

-- CreateIndex
CREATE INDEX "product_reservations_created_at_idx" ON "product_reservations"("created_at");

-- AddForeignKey
ALTER TABLE "product_reservations" ADD CONSTRAINT "product_reservations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
