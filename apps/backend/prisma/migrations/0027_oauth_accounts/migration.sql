-- CreateEnum
CREATE TYPE "OAuthProvider" AS ENUM ('GOOGLE', 'GITHUB');

-- CreateTable
CREATE TABLE "UserOAuthAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "OAuthProvider" NOT NULL,
    "providerUserId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserOAuthAccount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserOAuthAccount_provider_providerUserId_key" ON "UserOAuthAccount"("provider", "providerUserId");

-- CreateIndex
CREATE UNIQUE INDEX "UserOAuthAccount_userId_provider_key" ON "UserOAuthAccount"("userId", "provider");

-- CreateIndex
CREATE INDEX "UserOAuthAccount_email_idx" ON "UserOAuthAccount"("email");

-- AddForeignKey
ALTER TABLE "UserOAuthAccount" ADD CONSTRAINT "UserOAuthAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
