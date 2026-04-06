ALTER TABLE "User"
ADD COLUMN "isBlocked" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "User_role_isBlocked_createdAt_idx"
ON "User"("role", "isBlocked", "createdAt");
