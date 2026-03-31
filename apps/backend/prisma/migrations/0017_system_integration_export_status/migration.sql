ALTER TABLE "SystemIntegrationSettings"
ADD COLUMN "googleSheetsLastExportAt" TIMESTAMP(3),
ADD COLUMN "googleSheetsLastExportStatus" TEXT,
ADD COLUMN "googleSheetsLastExportMessage" TEXT,
ADD COLUMN "googleSheetsLastExportUrl" TEXT;
