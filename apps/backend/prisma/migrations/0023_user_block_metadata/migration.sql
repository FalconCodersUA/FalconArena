ALTER TABLE "User"
ADD COLUMN "blockedReason" TEXT,
ADD COLUMN "blockedAt" TIMESTAMP(3),
ADD COLUMN "blockedByUserId" TEXT;

ALTER TABLE "User"
ADD CONSTRAINT "User_blockedByUserId_fkey"
FOREIGN KEY ("blockedByUserId") REFERENCES "User"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

CREATE INDEX "User_blockedByUserId_idx" ON "User"("blockedByUserId");
