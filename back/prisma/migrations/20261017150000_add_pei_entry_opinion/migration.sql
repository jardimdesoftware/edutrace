-- Parecer semestral do professor, no próprio registro do PEI (mesmo estudante,
-- semestre, disciplina e professor). A Resolução CONSUP/IFPE nº 315/2025 pede o
-- parecer descritivo de desempenho ao fim do semestre, com os avanços, as
-- dificuldades e os apontamentos para o semestre seguinte, e o parecer usado
-- pelo AEE pede também o registro dos atendimentos individualizados que o
-- docente prestou (datas, horários, salas e meio de convocação). Quatro colunas
-- de texto, uma para cada item.
--
-- As colunas são TEXT NOT NULL DEFAULT '': o parecer nasce em branco (o POST do
-- registro não o aceita) e o autor o escreve depois. Os registros que já existem
-- ficam com o parecer em branco, e o banco preenche o default nas linhas
-- existentes sem backfill. O tamanho máximo de cada campo é validado no DTO,
-- antes de gravar.

-- AlterTable
ALTER TABLE "PeiEntry" ADD COLUMN     "individual_sessions" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "next_semester_notes" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "semester_difficulties" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "semester_progress" TEXT NOT NULL DEFAULT '';
