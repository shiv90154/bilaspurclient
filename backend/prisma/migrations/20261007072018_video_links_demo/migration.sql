-- AlterTable
ALTER TABLE "videos" ADD COLUMN     "externalUrl" TEXT,
ADD COLUMN     "isDemo" BOOLEAN NOT NULL DEFAULT false;
