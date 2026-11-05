-- Um CPF pode ter até duas contas: uma com e-mail @discente.ifpe.edu.br (aluno)
-- e outra com e-mail de profissional, para o ex-aluno que vira servidor. O
-- índice único sobre o CPF e o tipo do e-mail impede a segunda conta do mesmo
-- tipo e, com isso, a terceira conta. A expressão acompanha a troca de e-mail
-- sem que o aplicativo precise manter uma coluna de tipo.
-- O índice não é representável no schema.prisma (expressão), como os CHECKs de
-- roles da migration 20261026100000_add_user_roles.
DROP INDEX "User_cpf_key";

CREATE UNIQUE INDEX "User_cpf_account_type_key"
  ON "User" ("cpf", ((lower("email") LIKE '%@discente.ifpe.edu.br')));
