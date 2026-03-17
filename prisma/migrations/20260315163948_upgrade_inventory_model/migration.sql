/*
  Warnings:

  - You are about to drop the column `price` on the `inventory_items` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "inventory_items" DROP COLUMN "price",
ADD COLUMN     "financialTracking" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "imageUrl" TEXT,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "subcategory" TEXT,
ADD COLUMN     "totalPrice" DECIMAL(14,2),
ADD COLUMN     "unitPrice" DECIMAL(12,2);

-- CreateIndex
CREATE INDEX "inventory_items_category_idx" ON "inventory_items"("category");

-- CreateIndex
CREATE INDEX "inventory_items_subcategory_idx" ON "inventory_items"("subcategory");

-- CreateIndex
CREATE INDEX "inventory_items_status_idx" ON "inventory_items"("status");
