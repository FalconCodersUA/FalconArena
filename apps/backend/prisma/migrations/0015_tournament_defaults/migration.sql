ALTER TABLE "SystemIntegrationSettings"
ADD COLUMN "minTeamMembers" INTEGER,
ADD COLUMN "maxTeamMembers" INTEGER,
ADD COLUMN "defaultMinReviewersPerSubmission" INTEGER,
ADD COLUMN "defaultProjectTimeZone" TEXT,
ADD COLUMN "hideTeamsUntilRegistrationClose" BOOLEAN,
ADD COLUMN "defaultTournamentMaxTeams" INTEGER,
ADD COLUMN "defaultRegistrationWindowHours" INTEGER,
ADD COLUMN "defaultRoundDurationHours" INTEGER,
ADD COLUMN "defaultTournamentDescription" TEXT,
ADD COLUMN "defaultRoundDescription" TEXT;
