-- PEI por semestre e disciplina. O PEI deixa de ser um formulário único por
-- estudante (PlansEducation, student_email único) e passa a ser um conjunto de
-- registros, um por (estudante, semestre, disciplina), escritos pelo professor
-- da disciplina. Cada registro tem o autor, e só o autor o edita ou exclui.
--
-- A tabela antiga é RENOMEADA para PlansEducation_legacy, e não removida: os
-- registros atuais não têm correspondência campo a campo com o formato novo, e
-- remover a tabela os apagaria sem volta. Com o nome PlansEducation_legacy e o
-- @@map do model PlansEducationLegacy, o dado fica no banco, fora da API. O
-- RENAME TO muda só o nome da tabela: a chave primária, o índice único e a
-- sequence do id continuam com o prefixo PlansEducation e seriam recriados no
-- próximo migrate dev, então os três são renomeados aqui para os nomes que o
-- Prisma espera do model.
--
-- PeiEntry guarda o semestre no formato AAAA.S (validado no DTO), a disciplina
-- em texto livre e os sete campos de conteúdo: seis textos e a lista de pares
-- (conteúdo previsto na ementa e adequação), esta em JSONB. O tamanho e o tipo
-- de cada campo são validados no DTO, antes de gravar.
--
-- A unicidade é de (id_student, semester, subject) só entre os registros
-- ativos: o índice único é parcial (WHERE deleted_at IS NULL). O registro
-- excluído (deleted_at preenchido) continua no banco e sai do índice, então o
-- professor pode criar de novo o mesmo trio depois de excluir; dois registros
-- ativos iguais são recusados pelo banco (a API responde 409). A disciplina é
-- comparada pelo texto exato, depois do trim e da normalização NFC feitos no
-- DTO. Por ser parcial, o índice único só atende a consulta cujo WHERE implica
-- o predicado dele (id_student e deleted_at IS NULL, como a listagem do
-- estudante); a busca por id_student sozinho não o usa.
--
-- id_student referencia o estudante com ON DELETE RESTRICT, como o estudo de
-- caso e o PAEE: o PEI é registro pedagógico, e excluir a conta não o apaga em
-- silêncio. id_author referencia o professor que criou o registro com ON DELETE
-- SET NULL: a conta do autor pode ser excluída, e o registro continua com o
-- autor desconhecido. O PostgreSQL não cria índice para chave estrangeira, e as
-- duas procuram o registro pela coluna: o RESTRICT de id_student (também dos
-- registros excluídos logicamente, sem o predicado deleted_at IS NULL, que o
-- índice único parcial não atende) e o SET NULL de id_author. Sem um índice
-- comum em cada uma, toda exclusão de conta varreria a tabela, então id_student
-- e id_author têm índice próprio.
--
-- A tabela PeiEntry é nova, então a migration não toca em nenhuma linha
-- existente.

-- RenameTable
ALTER TABLE "PlansEducation" RENAME TO "PlansEducation_legacy";

-- RenameConstraint
ALTER TABLE "PlansEducation_legacy" RENAME CONSTRAINT "PlansEducation_pkey" TO "PlansEducation_legacy_pkey";

-- RenameIndex
ALTER INDEX "PlansEducation_student_email_key" RENAME TO "PlansEducation_legacy_student_email_key";

-- RenameSequence
ALTER SEQUENCE "PlansEducation_id_seq" RENAME TO "PlansEducation_legacy_id_seq";

-- CreateTable
CREATE TABLE "PeiEntry" (
    "id" SERIAL NOT NULL,
    "semester" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "adapted_objectives" TEXT NOT NULL,
    "prioritized_contents" TEXT NOT NULL,
    "syllabus_adaptations" JSONB NOT NULL,
    "adapted_methodologies" TEXT NOT NULL,
    "adapted_assessments" TEXT NOT NULL,
    "adapted_resources" TEXT NOT NULL,
    "general_notes" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),
    "id_student" INTEGER NOT NULL,
    "id_author" INTEGER,

    CONSTRAINT "PeiEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PeiEntry_id_student_idx" ON "PeiEntry"("id_student");

-- CreateIndex
CREATE INDEX "PeiEntry_id_author_idx" ON "PeiEntry"("id_author");

-- CreateIndex
CREATE UNIQUE INDEX "PeiEntry_id_student_semester_subject_key" ON "PeiEntry"("id_student", "semester", "subject") WHERE ("deleted_at" IS NULL);

-- AddForeignKey
ALTER TABLE "PeiEntry" ADD CONSTRAINT "PeiEntry_id_student_fkey" FOREIGN KEY ("id_student") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PeiEntry" ADD CONSTRAINT "PeiEntry_id_author_fkey" FOREIGN KEY ("id_author") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
