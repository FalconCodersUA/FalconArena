-- CreateTable
CREATE TABLE "TournamentJury" (
    "tournamentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TournamentJury_pkey" PRIMARY KEY ("tournamentId","userId")
);

-- CreateIndex
CREATE INDEX "TournamentJury_userId_assignedAt_idx" ON "TournamentJury"("userId", "assignedAt");

-- AddForeignKey
ALTER TABLE "TournamentJury" ADD CONSTRAINT "TournamentJury_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentJury" ADD CONSTRAINT "TournamentJury_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
