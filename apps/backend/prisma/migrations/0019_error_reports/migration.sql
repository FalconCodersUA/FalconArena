CREATE TABLE "ErrorReport" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "statusCode" INTEGER NOT NULL,
    "message" TEXT NOT NULL,
    "stack" TEXT,
    "userId" TEXT,
    "userRole" "Role",
    "userEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ErrorReport_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ErrorReport_createdAt_idx" ON "ErrorReport"("createdAt");
CREATE INDEX "ErrorReport_statusCode_createdAt_idx" ON "ErrorReport"("statusCode", "createdAt");
CREATE INDEX "ErrorReport_requestId_idx" ON "ErrorReport"("requestId");
