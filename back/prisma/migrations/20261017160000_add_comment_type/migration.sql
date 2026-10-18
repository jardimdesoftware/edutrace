-- Tipo da anotação multiprofissional: NOTE é a anotação comum (texto de até
-- 1000 caracteres) e CLASS_COUNCIL_REPORT é o relatório multiprofissional do
-- conselho de classe (texto de até 10000). O relatório é uma anotação com outro
-- tipo, então herda a autoria, o histórico e o limite de edições.
--
-- A coluna é NOT NULL DEFAULT 'NOTE': as anotações que já existem viram NOTE,
-- e o banco preenche o default nas linhas existentes sem backfill. Um INSERT
-- que não informa o tipo também grava NOTE. O limite de caracteres de cada tipo
-- é validado na API (DTO e service), antes de gravar.

-- CreateEnum
CREATE TYPE "CommentType" AS ENUM ('NOTE', 'CLASS_COUNCIL_REPORT');

-- AlterTable
ALTER TABLE "Comments" ADD COLUMN     "type" "CommentType" NOT NULL DEFAULT 'NOTE';
