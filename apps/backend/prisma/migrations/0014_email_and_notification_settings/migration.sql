ALTER TABLE "SystemIntegrationSettings"
ADD COLUMN "emailNotificationsEnabled" BOOLEAN,
ADD COLUMN "emailProvider" TEXT,
ADD COLUMN "emailFrom" TEXT,
ADD COLUMN "emailReplyTo" TEXT,
ADD COLUMN "resendApiKey" TEXT,
ADD COLUMN "emailLastCheckedAt" TIMESTAMP(3),
ADD COLUMN "emailLastCheckStatus" TEXT,
ADD COLUMN "emailLastCheckMessage" TEXT,
ADD COLUMN "notifyRegistrationStarted" BOOLEAN,
ADD COLUMN "notifyRoundStarted" BOOLEAN,
ADD COLUMN "notifySubmissionReceived" BOOLEAN,
ADD COLUMN "notifyDeadlineReminder" BOOLEAN,
ADD COLUMN "notifySubmissionClosed" BOOLEAN;
