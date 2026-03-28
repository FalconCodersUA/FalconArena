-- CreateEnum
CREATE TYPE "TournamentScheduleEventType" AS ENUM (
  'ROUND',
  'CONSULTATION',
  'DEADLINE',
  'ANNOUNCEMENT',
  'OTHER'
);

-- CreateTable
CREATE TABLE "TournamentScheduleEvent" (
  "id" TEXT NOT NULL,
  "tournamentId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "type" "TournamentScheduleEventType" NOT NULL DEFAULT 'OTHER',
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3),
  "location" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "TournamentScheduleEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TournamentScheduleEvent_tournamentId_startsAt_idx"
ON "TournamentScheduleEvent"("tournamentId", "startsAt");

-- AddForeignKey
ALTER TABLE "TournamentScheduleEvent"
ADD CONSTRAINT "TournamentScheduleEvent_tournamentId_fkey"
FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;
