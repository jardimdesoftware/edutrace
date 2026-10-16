-- Matrícula e curso identificam o estudante nos documentos da Resolução
-- CONSUP/IFPE nº 315/2025. As colunas são opcionais porque só o nível
-- Estudante/Família as usa: as contas que já existem e a criada no primeiro
-- login com Google ficam sem os dois valores até o administrador preencher.
-- O índice único da matrícula admite várias linhas nulas, então a migration
-- não falha em um banco que já tem usuários.

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "course" TEXT,
ADD COLUMN     "enrollment_number" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_enrollment_number_key" ON "User"("enrollment_number");
