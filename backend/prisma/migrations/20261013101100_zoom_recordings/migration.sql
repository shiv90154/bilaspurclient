-- Zoom cloud recordings copied into our storage and attached to the class's batch (docs/14).
-- CreateEnum
CREATE TYPE "RecordingImportStatus" AS ENUM ('PENDING', 'DOWNLOADING', 'DONE', 'FAILED', 'SKIPPED');

-- AlterTable
ALTER TABLE "class_recordings" ADD COLUMN     "videoId" TEXT;

-- AlterTable
ALTER TABLE "videos" ADD COLUMN     "sourceStore" TEXT;

-- CreateTable
CREATE TABLE "recording_imports" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'zoom',
    "recordingUuid" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "topic" TEXT,
    "startedAt" TIMESTAMP(3),
    "durationSec" INTEGER,
    "status" "RecordingImportStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "classId" TEXT,
    "videoId" TEXT,
    "payload" JSONB NOT NULL,
    "downloadToken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recording_imports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "recording_imports_recordingUuid_key" ON "recording_imports"("recordingUuid");

-- CreateIndex
CREATE INDEX "recording_imports_status_updatedAt_idx" ON "recording_imports"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "class_recordings_classId_idx" ON "class_recordings"("classId");

-- AddForeignKey
ALTER TABLE "class_recordings" ADD CONSTRAINT "class_recordings_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "videos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recording_imports" ADD CONSTRAINT "recording_imports_classId_fkey" FOREIGN KEY ("classId") REFERENCES "live_classes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recording_imports" ADD CONSTRAINT "recording_imports_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "videos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Zoom meeting number of existing classes, so their recordings can be matched.
UPDATE "live_classes" SET "meetingId" = substring("joinUrl" from 'zoom\.us/(?:j|w|s|wc/join)/([0-9]{9,12})')
WHERE "type" = 'ZOOM' AND "meetingId" IS NULL AND "joinUrl" ~ 'zoom\.us/(?:j|w|s|wc/join)/[0-9]{9,12}';
