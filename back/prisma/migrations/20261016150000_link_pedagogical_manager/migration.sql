-- Responsável pedagógico do estudante. O texto livre User.pedagogical_manager
-- dá lugar a um vínculo: um servidor (Profissional da Educação ou Profissional
-- NAPNE, pela chave estrangeira pedagogical_manager_id) ou uma pessoa externa,
-- identificada por nome, telefone e CPF.
--
-- A coluna de texto é RENOMEADA, e não removida: os valores já gravados ali não
-- têm como virar um vínculo, e um DROP COLUMN os apagaria sem volta. Com o nome
-- pedagogical_manager_legacy e o @ignore no schema, o dado fica no banco e
-- nenhuma consulta do Prisma o devolve. O nome pedagogical_manager passa a ser a
-- relação com o servidor.
--
-- Ao excluir o servidor, os estudantes dele ficam sem responsável (ON DELETE
-- SET NULL). Esse SET NULL e a limpeza da troca de nível do servidor procuram os
-- estudantes por pedagogical_manager_id, que por isso tem índice: o PostgreSQL
-- não cria índice para chave estrangeira, e sem ele cada exclusão ou troca de
-- nível varreria a tabela User inteira.
--
-- O Prisma não declara CHECK, então as duas regras abaixo ficam só aqui e não
-- geram drift no migrate diff. Elas valem para toda gravação, inclusive as que
-- não passam pela API:
--   * o responsável é de um tipo só: com servidor vinculado, os três campos do
--     externo ficam nulos;
--   * o externo é completo: ou os três campos estão preenchidos, ou nenhum.
-- As linhas que já existem têm todas as colunas novas nulas, então os CHECKs
-- passam sem backfill.

-- AlterTable
ALTER TABLE "User" RENAME COLUMN "pedagogical_manager" TO "pedagogical_manager_legacy";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "external_manager_cpf" TEXT,
ADD COLUMN     "external_manager_name" TEXT,
ADD COLUMN     "external_manager_phone" TEXT,
ADD COLUMN     "pedagogical_manager_id" INTEGER;

-- CreateIndex
CREATE INDEX "User_pedagogical_manager_id_idx" ON "User"("pedagogical_manager_id");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_pedagogical_manager_id_fkey" FOREIGN KEY ("pedagogical_manager_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Checks
ALTER TABLE "User" ADD CONSTRAINT "User_pedagogical_manager_one_kind_chk" CHECK ("pedagogical_manager_id" IS NULL OR num_nonnulls("external_manager_name", "external_manager_phone", "external_manager_cpf") = 0);
ALTER TABLE "User" ADD CONSTRAINT "User_external_manager_complete_chk" CHECK (num_nonnulls("external_manager_name", "external_manager_phone", "external_manager_cpf") IN (0, 3));
