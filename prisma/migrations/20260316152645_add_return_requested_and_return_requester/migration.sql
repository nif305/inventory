-- AlterEnum
ALTER TYPE "CustodyStatus" ADD VALUE 'RETURN_REQUESTED';

-- CreateIndex
CREATE INDEX "return_requests_custodyId_idx" ON "return_requests"("custodyId");

-- CreateIndex
CREATE INDEX "return_requests_requesterId_idx" ON "return_requests"("requesterId");

-- CreateIndex
CREATE INDEX "return_requests_status_idx" ON "return_requests"("status");

-- AddForeignKey
ALTER TABLE "return_requests" ADD CONSTRAINT "return_requests_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
