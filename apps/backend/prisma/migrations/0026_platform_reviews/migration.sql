CREATE TYPE "PlatformReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TABLE "PlatformReview" (
  "id" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "text" TEXT NOT NULL,
  "status" "PlatformReviewStatus" NOT NULL DEFAULT 'PENDING',
  "moderatorId" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PlatformReview_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PlatformReview_authorId_key" ON "PlatformReview"("authorId");
CREATE INDEX "PlatformReview_status_updatedAt_idx" ON "PlatformReview"("status", "updatedAt");
CREATE INDEX "PlatformReview_moderatorId_idx" ON "PlatformReview"("moderatorId");

ALTER TABLE "PlatformReview"
ADD CONSTRAINT "PlatformReview_authorId_fkey"
FOREIGN KEY ("authorId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PlatformReview"
ADD CONSTRAINT "PlatformReview_moderatorId_fkey"
FOREIGN KEY ("moderatorId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
