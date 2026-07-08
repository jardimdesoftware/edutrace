-- AlterTable
ALTER TABLE "User" ADD COLUMN     "password_reset_attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "password_reset_expires" TIMESTAMP(3),
ADD COLUMN     "password_reset_token" TEXT;
