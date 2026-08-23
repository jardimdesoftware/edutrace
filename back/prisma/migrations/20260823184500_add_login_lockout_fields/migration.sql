-- AlterTable
ALTER TABLE "User" ADD COLUMN     "failed_login_attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "locked_until" TIMESTAMP(3),
ADD COLUMN     "login_lock_count" INTEGER NOT NULL DEFAULT 0;
