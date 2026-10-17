-- Estudo de caso do estudante, escrito pelo Profissional NAPNE com o parecer
-- do professor do AEE. Um por estudante: id_student é UNIQUE, e o segundo
-- estudo de caso do mesmo estudante é recusado pelo banco (a API responde 409).
--
-- As seções com campos fixos ficam em colunas JSONB, uma por seção, e os dois
-- textos soltos (potentialities_interests e barriers) em TEXT. O tamanho e o
-- tipo de cada campo são validados no DTO, antes de gravar.
--
-- id_student referencia o estudante com ON DELETE RESTRICT, como as anotações
-- (Comments.id_user): o estudo de caso é registro clínico-pedagógico, e excluir
-- a conta não o apaga em silêncio. id_author referencia o Profissional NAPNE que
-- criou o registro com ON DELETE SET NULL: a conta do autor pode ser excluída, e
-- o estudo de caso continua com o autor desconhecido. Esse SET NULL procura o
-- registro por id_author, que por isso tem índice: o PostgreSQL não cria índice
-- para chave estrangeira, e sem ele cada exclusão de conta varreria a tabela.
--
-- A tabela é nova, então a migration não toca em nenhuma linha existente.

-- CreateTable
CREATE TABLE "CaseStudy" (
    "id" SERIAL NOT NULL,
    "identification" JSONB NOT NULL,
    "general_info" JSONB NOT NULL,
    "school_history" JSONB NOT NULL,
    "pedagogical_aspects" JSONB NOT NULL,
    "behavioral_social" JSONB NOT NULL,
    "potentialities_interests" TEXT NOT NULL,
    "barriers" TEXT NOT NULL,
    "resources_strategies" JSONB NOT NULL,
    "pei_recommendations" JSONB NOT NULL,
    "aee_opinion" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),
    "id_student" INTEGER NOT NULL,
    "id_author" INTEGER,

    CONSTRAINT "CaseStudy_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CaseStudy_id_student_key" ON "CaseStudy"("id_student");

-- CreateIndex
CREATE INDEX "CaseStudy_id_author_idx" ON "CaseStudy"("id_author");

-- AddForeignKey
ALTER TABLE "CaseStudy" ADD CONSTRAINT "CaseStudy_id_student_fkey" FOREIGN KEY ("id_student") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseStudy" ADD CONSTRAINT "CaseStudy_id_author_fkey" FOREIGN KEY ("id_author") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

