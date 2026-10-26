-- Um usuário passa a ter uma lista de papéis ("roles"), e não mais um único
-- nível ("id_level"). O Administrador (1) e o Estudante/Família (2) ficam
-- sozinhos; os profissionais (3, 4, 5 e 6) combinam livremente. A lista é
-- guardada na própria linha do usuário, e não numa tabela de junção, para que as
-- travas FOR UPDATE na linha do User continuem serializando a troca de papéis, a
-- fila de atendimento e o responsável pedagógico, e para que as regras abaixo
-- continuem sendo CHECKs.
--
-- O id 6 é o papel Professor do AEE (LEVELS.PROFESSOR_AEE), e a autorização
-- decide pelo id. Como na reserva do id 5 (20261016120000_reserve_level_napne),
-- todo nível que já esteja no id 6, com qualquer nome, é anterior a esta
-- mudança, e ninguém concedeu o acesso aos usuários dele: ele e seus usuários
-- vão para um id livre a partir de 100 (User_id_level_fkey é ON UPDATE CASCADE,
-- então o id novo leva os usuários junto). Isso vale até para um nível que já
-- se chame Professor do AEE: o nome não prova que os usuários dele tenham o
-- papel. O nome do nível é único, e um Professor do AEE que esteja em outro id
-- (inclusive o que acabou de sair do id 6) recebe o sufixo com o próprio id
-- antes de o nível 6 ser gravado.
--
-- O papel não tem como representar um nível fora de 1 a 6. Usuário num nível
-- assim (um nível criado pela antiga rota POST /levels, ou o que a reserva acima
-- acabou de realocar) já não passava em nenhuma rota, e converter a conta num
-- papel com acesso daria um privilégio que ninguém concedeu. A migration para
-- com a lista deles, para o administrador excluir a conta ou ajustar o nível
-- antes de repetir a migration.
--
-- As contas NAPNE existentes (id_level 5) viram {5, 6}: o NAPNE de hoje faz o
-- que o Professor do AEE faz, e a divisão entre os dois papéis é da próxima
-- mudança. Todas as outras viram {id_level}.
--
-- O Prisma não declara CHECK, então as regras abaixo ficam só aqui e não geram
-- drift no migrate diff. Elas valem para toda gravação, inclusive as que não
-- passam pela API. A unicidade usa uma função, porque o CHECK não aceita
-- subconsulta (unnest).

-- Reserva do id 6
UPDATE "Level" SET id = (SELECT GREATEST(max(id) + 1, 100) FROM "Level") WHERE id = 6;
UPDATE "Level" SET name = name || ' (nível ' || id || ')' WHERE name = 'Professor do AEE' AND id <> 6;
INSERT INTO "Level" (id, name, updated_at) VALUES (6, 'Professor do AEE', now()) ON CONFLICT (id) DO NOTHING;

-- AlterTable
ALTER TABLE "User" ADD COLUMN "roles" INTEGER[];

-- Backfill
UPDATE "User" SET "roles" = CASE WHEN "id_level" = 5 THEN ARRAY[5, 6] ELSE ARRAY["id_level"] END;

DO $$
DECLARE
  orphans TEXT;
BEGIN
  SELECT string_agg("email" || ' (nível ' || "id_level" || ')', ', ' ORDER BY "id") INTO orphans
  FROM "User" WHERE NOT ("roles" <@ ARRAY[1, 2, 3, 4, 5, 6]);

  IF orphans IS NOT NULL THEN
    RAISE EXCEPTION 'Usuários em nível fora de 1 a 6, que não tem papel equivalente: %. Exclua as contas ou mude o nível delas antes de repetir a migration.', orphans;
  END IF;
END
$$;

ALTER TABLE "User" ALTER COLUMN "roles" SET NOT NULL;

-- Sem repetição. Mesma regra do DTO (rolesCompositionError). A unicidade olha os
-- elementos achatados, então a lista precisa ter uma dimensão só (array_ndims
-- no CHECK de não vazio), ou '{{3,6}}' passaria por todos.
CREATE FUNCTION "roles_are_unique"(roles INTEGER[]) RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
AS $$ SELECT cardinality(roles) = (SELECT count(DISTINCT role) FROM unnest(roles) AS role) $$;

-- Checks
ALTER TABLE "User" ADD CONSTRAINT "User_roles_not_empty_chk" CHECK (cardinality("roles") >= 1 AND array_ndims("roles") = 1);
ALTER TABLE "User" ADD CONSTRAINT "User_roles_known_chk" CHECK ("roles" <@ ARRAY[1, 2, 3, 4, 5, 6]);
ALTER TABLE "User" ADD CONSTRAINT "User_roles_unique_chk" CHECK ("roles_are_unique"("roles"));
ALTER TABLE "User" ADD CONSTRAINT "User_roles_exclusive_chk" CHECK (NOT ("roles" && ARRAY[1, 2]) OR cardinality("roles") = 1);

-- Os dois CHECKs da fila deixam de olhar o id_level e passam a olhar os papéis.
-- service_capacity continua só com o papel 5, de 0 a 200.
ALTER TABLE "User" DROP CONSTRAINT "User_service_status_level_chk";
ALTER TABLE "User" DROP CONSTRAINT "User_service_capacity_chk";
ALTER TABLE "User" ADD CONSTRAINT "User_service_status_level_chk" CHECK ((2 = ANY("roles")) = ("service_status" IS NOT NULL));
ALTER TABLE "User" ADD CONSTRAINT "User_service_capacity_chk" CHECK ("service_capacity" IS NULL OR (5 = ANY("roles") AND "service_capacity" BETWEEN 0 AND 200));

-- DropForeignKey
ALTER TABLE "User" DROP CONSTRAINT "User_id_level_fkey";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "id_level";
