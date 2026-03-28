CREATE TYPE "NotificationAudience" AS ENUM ('ALL', 'TEAM', 'JURY', 'ADMIN', 'ORGANIZER', 'USER');
CREATE TYPE "NotificationType" AS ENUM ('REGISTRATION_STARTED', 'ROUND_STARTED', 'SUBMISSION_RECEIVED', 'SUBMISSION_CLOSED', 'GENERAL');

CREATE TABLE "Notification" (
  "id" TEXT NOT NULL,
  "type" "NotificationType" NOT NULL DEFAULT 'GENERAL',
  "audience" "NotificationAudience" NOT NULL DEFAULT 'ALL',
  "userId" TEXT,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "linkUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "NotificationReadState" (
  "notificationId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "NotificationReadState_pkey" PRIMARY KEY ("notificationId","userId")
);

CREATE INDEX "Notification_audience_createdAt_idx" ON "Notification"("audience", "createdAt");
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");
CREATE INDEX "NotificationReadState_userId_readAt_idx" ON "NotificationReadState"("userId", "readAt");

ALTER TABLE "Notification"
ADD CONSTRAINT "Notification_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "NotificationReadState"
ADD CONSTRAINT "NotificationReadState_notificationId_fkey"
FOREIGN KEY ("notificationId") REFERENCES "Notification"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "NotificationReadState"
ADD CONSTRAINT "NotificationReadState_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
