CREATE TABLE "SystemIntegrationSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "googleSheetsWebhookUrl" TEXT,
    "googleSheetsWebhookSecret" TEXT,
    "googleSheetsDefaultSheetName" TEXT,
    "googleSheetsLastCheckedAt" TIMESTAMP(3),
    "googleSheetsLastCheckStatus" TEXT,
    "googleSheetsLastCheckMessage" TEXT,
    "updatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemIntegrationSettings_pkey" PRIMARY KEY ("id")
);
