-- AlterTable
ALTER TABLE "tests" ADD COLUMN     "seriesId" TEXT;

-- CreateTable
CREATE TABLE "test_series" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "courseId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "test_series_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "test_series_name_key" ON "test_series"("name");

-- CreateIndex
CREATE INDEX "tests_seriesId_idx" ON "tests"("seriesId");

-- AddForeignKey
ALTER TABLE "tests" ADD CONSTRAINT "tests_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "test_series"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_series" ADD CONSTRAINT "test_series_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
