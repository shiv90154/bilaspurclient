-- CreateTable
CREATE TABLE "app_releases" (
    "id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "fileKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "notes" TEXT,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "app_releases_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "app_releases_version_key" ON "app_releases"("version");

-- CreateIndex
CREATE INDEX "app_releases_createdAt_idx" ON "app_releases"("createdAt");
