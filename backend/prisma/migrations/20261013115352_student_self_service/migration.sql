-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterEnum
ALTER TYPE "OtpPurpose" ADD VALUE 'CHANGE_EMAIL';

-- AlterTable
ALTER TABLE "student_documents" ADD COLUMN     "byStudent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "reviewNote" TEXT,
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "status" "DocumentStatus" NOT NULL DEFAULT 'APPROVED';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "notifyPrefs" JSONB;

-- CreateIndex
CREATE INDEX "student_documents_status_idx" ON "student_documents"("status");
