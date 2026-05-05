-- CreateEnum
CREATE TYPE "AnnouncementVisibility" AS ENUM ('AUTHENTICATED', 'PUBLIC');

-- AlterTable
ALTER TABLE "Announcement"
ADD COLUMN "tournamentId" TEXT,
ADD COLUMN "visibility" "AnnouncementVisibility" NOT NULL DEFAULT 'AUTHENTICATED';

-- CreateIndex
CREATE INDEX "Announcement_tournamentId_visibility_isActive_publishedAt_idx"
ON "Announcement"("tournamentId", "visibility", "isActive", "publishedAt");

-- AddForeignKey
ALTER TABLE "Announcement"
ADD CONSTRAINT "Announcement_tournamentId_fkey"
FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;
