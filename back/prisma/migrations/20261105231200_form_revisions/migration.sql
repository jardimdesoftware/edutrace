-- CreateEnum
CREATE TYPE "FormType" AS ENUM ('SCREENING', 'ANAMNESIS', 'CASE_STUDY', 'AEE_PLAN');

-- CreateTable
CREATE TABLE "FormRevision" (
    "id" SERIAL NOT NULL,
    "form_type" "FormType" NOT NULL,
    "record_key" TEXT NOT NULL DEFAULT '',
    "version" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "author_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "id_student" INTEGER NOT NULL,
    "id_author" INTEGER,

    CONSTRAINT "FormRevision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FormRevision_id_student_idx" ON "FormRevision"("id_student");

-- CreateIndex
CREATE UNIQUE INDEX "FormRevision_form_type_id_student_record_key_version_key" ON "FormRevision"("form_type", "id_student", "record_key", "version");

-- AddForeignKey
ALTER TABLE "FormRevision" ADD CONSTRAINT "FormRevision_id_student_fkey" FOREIGN KEY ("id_student") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Teto de 5 versões por formulário (a criação é a versão 1), também no banco.
-- O CHECK não é representável no schema.prisma, como os CHECKs de roles da
-- migration 20261026100000_add_user_roles.
ALTER TABLE "FormRevision"
  ADD CONSTRAINT "FormRevision_version_range_chk" CHECK ("version" BETWEEN 1 AND 5);
