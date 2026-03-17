-- CreateEnum
CREATE TYPE "ReturnItemCondition" AS ENUM ('GOOD', 'PARTIAL_DAMAGE', 'TOTAL_DAMAGE');

-- AlterTable
ALTER TABLE "return_requests" ADD COLUMN     "damageDetails" TEXT,
ADD COLUMN     "damageImages" TEXT,
ADD COLUMN     "declarationAck" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "receivedImages" TEXT,
ADD COLUMN     "receivedNotes" TEXT,
ADD COLUMN     "receivedType" "ReturnItemCondition",
ADD COLUMN     "returnType" "ReturnItemCondition" NOT NULL DEFAULT 'GOOD';
