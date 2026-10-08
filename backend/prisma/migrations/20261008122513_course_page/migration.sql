-- AlterTable
ALTER TABLE "courses" ADD COLUMN     "audience" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "duration" TEXT,
ADD COLUMN     "faqs" JSONB,
ADD COLUMN     "highlights" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "includes" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "language" TEXT,
ADD COLUMN     "tagline" TEXT;

-- AlterTable
ALTER TABLE "fee_plans" ADD COLUMN     "mrp" DECIMAL(10,2);
