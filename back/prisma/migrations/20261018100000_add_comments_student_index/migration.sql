-- A lista de anotações de um estudante é paginada por id decrescente
-- (WHERE "id_user" = ? AND "id" < ? ORDER BY "id" DESC LIMIT ?). Sem índice, o
-- PostgreSQL lê a tabela inteira de todos os estudantes e ordena o resultado a
-- cada página. O índice (id_user, id) entrega as anotações do estudante já na
-- ordem do id, e a leitura para no LIMIT.

-- CreateIndex
CREATE INDEX "Comments_id_user_id_idx" ON "Comments"("id_user", "id");
