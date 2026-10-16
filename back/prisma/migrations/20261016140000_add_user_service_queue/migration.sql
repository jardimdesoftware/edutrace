-- Fila de atendimento do NAPNE. Todo usuário de nível Estudante/Família (id 2)
-- passa a ter um status de atendimento (WAITING, IN_SERVICE ou CLOSED), a data
-- em que entrou na fila e, quando atendido, o Profissional NAPNE responsável. O
-- Profissional NAPNE (id 5) ganha service_capacity, o limite de estudantes que
-- atende ao mesmo tempo.
--
-- Os estudantes que já existem entram na fila como WAITING, com queued_at igual
-- ao created_at, para que a ordem de chegada preserve a ordem do cadastro. O
-- UPDATE precisa rodar antes dos CHECKs: com o CHECK de nível já criado, a
-- migration falharia em qualquer banco que tenha estudantes.
--
-- O Prisma não declara CHECK, então as três regras abaixo ficam só aqui e não
-- geram drift no migrate diff. Elas valem para toda gravação, inclusive as que
-- não passam pela API:
--   * só o nível 2 tem status de atendimento, e todo nível 2 tem;
--   * quem está IN_SERVICE tem responsável;
--   * service_capacity existe só no nível 5, de 0 a 200.

-- CreateEnum
CREATE TYPE "ServiceStatus" AS ENUM ('WAITING', 'IN_SERVICE', 'CLOSED');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "napne_responsible_id" INTEGER,
ADD COLUMN     "queued_at" TIMESTAMP(3),
ADD COLUMN     "service_capacity" INTEGER,
ADD COLUMN     "service_closed_at" TIMESTAMP(3),
ADD COLUMN     "service_started_at" TIMESTAMP(3),
ADD COLUMN     "service_status" "ServiceStatus";

-- CreateIndex
CREATE INDEX "User_napne_responsible_id_service_status_idx" ON "User"("napne_responsible_id", "service_status");

-- CreateIndex
CREATE INDEX "User_service_status_queued_at_idx" ON "User"("service_status", "queued_at");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_napne_responsible_id_fkey" FOREIGN KEY ("napne_responsible_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill
UPDATE "User" SET "service_status" = 'WAITING', "queued_at" = "created_at" WHERE "id_level" = 2 AND "service_status" IS NULL;

-- Checks
ALTER TABLE "User" ADD CONSTRAINT "User_service_status_level_chk" CHECK (("id_level" = 2) = ("service_status" IS NOT NULL));
ALTER TABLE "User" ADD CONSTRAINT "User_in_service_has_napne_chk" CHECK ("service_status" IS DISTINCT FROM 'IN_SERVICE' OR "napne_responsible_id" IS NOT NULL);
ALTER TABLE "User" ADD CONSTRAINT "User_service_capacity_chk" CHECK ("service_capacity" IS NULL OR ("id_level" = 5 AND "service_capacity" BETWEEN 0 AND 200));
