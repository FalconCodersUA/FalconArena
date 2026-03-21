-- CreateTable
CREATE TABLE "UserSettings" (
    "userId" TEXT NOT NULL,
    "userName" TEXT,
    "dateOfBirth" TIMESTAMP(3),
    "presentAddress" TEXT,
    "permanentAddress" TEXT,
    "city" TEXT,
    "postalCode" TEXT,
    "country" TEXT,
    "interfaceLanguage" TEXT,
    "timeZone" TEXT,
    "notifyAnnouncements" BOOLEAN NOT NULL DEFAULT true,
    "notifyReviews" BOOLEAN NOT NULL DEFAULT false,
    "notifyMessages" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserSettings_pkey" PRIMARY KEY ("userId")
);

-- AddForeignKey
ALTER TABLE "UserSettings"
ADD CONSTRAINT "UserSettings_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
