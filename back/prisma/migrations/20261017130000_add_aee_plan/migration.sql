-- Plano de Atendimento Educacional Especializado (PAEE) do estudante, escrito
-- pelo Profissional NAPNE (docente de AEE) a cada período letivo. Diferente do
-- estudo de caso, que é um por estudante, o PAEE é refeito a cada período: a
-- unicidade é do par (id_student, semester), e o segundo PAEE do mesmo estudante
-- no mesmo período é recusado pelo banco (a API responde 409). O mesmo estudante
-- tem um PAEE em cada período. O índice único também atende a busca por
-- estudante, porque id_student é a primeira coluna dele.
--
-- semester guarda o período no formato AAAA.S (por exemplo 2026.2), validado no
-- DTO. As seções com campos fixos ficam em colunas JSONB, uma por seção, e os
-- textos e o has_diagnosis em colunas próprias. O tamanho e o tipo de cada
-- campo são validados no DTO, antes de gravar.
--
-- id_student referencia o estudante com ON DELETE RESTRICT, como o estudo de
-- caso e as anotações: o PAEE é registro pedagógico, e excluir a conta não o
-- apaga em silêncio. id_author referencia o Profissional NAPNE que criou o
-- registro com ON DELETE SET NULL: a conta do autor pode ser excluída, e o PAEE
-- continua com o autor desconhecido. Esse SET NULL procura o registro por
-- id_author, que por isso tem índice: o PostgreSQL não cria índice para chave
-- estrangeira, e sem ele cada exclusão de conta varreria a tabela.
--
-- A tabela é nova, então a migration não toca em nenhuma linha existente.

-- CreateTable
CREATE TABLE "AeePlan" (
    "id" SERIAL NOT NULL,
    "semester" TEXT NOT NULL,
    "identification" JSONB NOT NULL,
    "basis" TEXT NOT NULL,
    "has_diagnosis" BOOLEAN NOT NULL,
    "supports" JSONB NOT NULL,
    "purpose" JSONB NOT NULL,
    "objectives" JSONB NOT NULL,
    "evaluation_procedures" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),
    "id_student" INTEGER NOT NULL,
    "id_author" INTEGER,

    CONSTRAINT "AeePlan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AeePlan_id_author_idx" ON "AeePlan"("id_author");

-- CreateIndex
CREATE UNIQUE INDEX "AeePlan_id_student_semester_key" ON "AeePlan"("id_student", "semester");

-- AddForeignKey
ALTER TABLE "AeePlan" ADD CONSTRAINT "AeePlan_id_student_fkey" FOREIGN KEY ("id_student") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AeePlan" ADD CONSTRAINT "AeePlan_id_author_fkey" FOREIGN KEY ("id_author") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

