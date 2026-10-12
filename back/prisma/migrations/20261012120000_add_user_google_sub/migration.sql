-- AlterTable
ALTER TABLE "User" ADD COLUMN     "google_sub" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_google_sub_key" ON "User"("google_sub");

-- A conta criada pelo login com Google e com o cadastro ainda pendente guarda o
-- sub no CPF provisório (google:<sub>), único lugar onde ele está gravado. Essas
-- contas não têm senha conhecida e continuam entrando pelo Google.
UPDATE "User" SET "google_sub" = substr("cpf", 8) WHERE "cpf" LIKE 'google:%';
