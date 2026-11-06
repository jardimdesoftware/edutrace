-- CreateEnum
CREATE TYPE "ReferralKind" AS ENUM ('ASSIGNED', 'REMOVED');

-- CreateTable
CREATE TABLE "AeeReferral" (
    "id" SERIAL NOT NULL,
    "kind" "ReferralKind" NOT NULL,
    "student_name" TEXT NOT NULL,
    "from_name" TEXT NOT NULL,
    "id_from" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "seen_at" TIMESTAMP(3),
    "id_student" INTEGER NOT NULL,
    "id_to" INTEGER NOT NULL,

    CONSTRAINT "AeeReferral_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AeeReferral_id_to_seen_at_idx" ON "AeeReferral"("id_to", "seen_at");

-- CreateIndex
CREATE INDEX "AeeReferral_id_student_idx" ON "AeeReferral"("id_student");

-- AddForeignKey
ALTER TABLE "AeeReferral" ADD CONSTRAINT "AeeReferral_id_student_fkey" FOREIGN KEY ("id_student") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AeeReferral" ADD CONSTRAINT "AeeReferral_id_to_fkey" FOREIGN KEY ("id_to") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
