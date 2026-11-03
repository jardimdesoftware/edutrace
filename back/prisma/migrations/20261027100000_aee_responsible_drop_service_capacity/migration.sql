-- O atendimento passa do Profissional NAPNE para o Professor do AEE (papel 6),
-- com limite fixo de 15 estudantes em atendimento por professor (constante
-- AEE_SERVICE_CAPACITY no back). O responsável do atendimento deixa de se chamar
-- napne_responsible_id e passa a aee_responsible_id, e o limite deixa de ser um
-- campo editável: service_capacity e o CHECK dele saem.
--
-- É RENAME, e não DROP e ADD: os atendimentos em andamento (IN_SERVICE) mantêm o
-- responsável que já tinham. As contas NAPNE viraram {5, 6} na migration
-- 20261026100000_add_user_roles, então o responsável de um atendimento em
-- andamento já tem o papel 6, a menos que a conta o tenha perdido depois (deploy
-- isolado da migration anterior). Nesse caso a migration recusa e desfaz tudo.
--
-- O índice, a chave estrangeira e o CHECK que exige responsável em IN_SERVICE
-- também são renomeados, para o migrate diff não apontar drift.

BEGIN;

DO $$
DECLARE
  orphans TEXT;
BEGIN
  SELECT string_agg(r."email", ', ' ORDER BY r."id") INTO orphans
  FROM "User" r
  WHERE NOT (6 = ANY(r."roles"))
    AND EXISTS (
      SELECT 1 FROM "User" s
      WHERE s."napne_responsible_id" = r."id" AND s."service_status" = 'IN_SERVICE'
    );

  IF orphans IS NOT NULL THEN
    RAISE EXCEPTION 'Contas sem o papel 6 (Professor do AEE) são responsáveis por estudantes em atendimento: %. Encerre os atendimentos ou devolva o papel 6 a elas, depois rode npx prisma migrate resolve --rolled-back 20261027100000_aee_responsible_drop_service_capacity e repita o deploy.', orphans;
  END IF;
END
$$;

ALTER TABLE "User" RENAME COLUMN "napne_responsible_id" TO "aee_responsible_id";

ALTER INDEX "User_napne_responsible_id_service_status_idx" RENAME TO "User_aee_responsible_id_service_status_idx";

ALTER TABLE "User" RENAME CONSTRAINT "User_napne_responsible_id_fkey" TO "User_aee_responsible_id_fkey";

ALTER TABLE "User" RENAME CONSTRAINT "User_in_service_has_napne_chk" TO "User_in_service_has_aee_chk";

ALTER TABLE "User" DROP CONSTRAINT "User_service_capacity_chk";

ALTER TABLE "User" DROP COLUMN "service_capacity";

COMMIT;
