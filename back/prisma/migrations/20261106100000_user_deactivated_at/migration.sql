-- Usuário desativado: some do sistema como o excluído, mas nunca é apagado pelo
-- job da carência, porque tem dados (escritos por ele ou sobre ele). O
-- deleted_at continua sendo "sem acesso" e o deactivated_at marca quem fica
-- guardado sem prazo. O CHECK garante que não existe desativado com acesso.
ALTER TABLE "User" ADD COLUMN "deactivated_at" TIMESTAMP(3);

ALTER TABLE "User"
  ADD CONSTRAINT "User_deactivated_requires_deleted_chk"
  CHECK ("deactivated_at" IS NULL OR "deleted_at" IS NOT NULL);
