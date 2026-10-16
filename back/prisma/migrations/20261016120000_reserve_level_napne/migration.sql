-- O id 5 passa a ser o nível Profissional NAPNE (LEVELS.PROFISSIONAL_NAPNE), e a
-- autorização decide pelo id. Um nível que já esteja no id 5 quando esta
-- migration roda é anterior a esta mudança (a antiga rota POST /levels criava
-- níveis com o id da sequence, e a PATCH renomeava qualquer um), então ninguém
-- concedeu o acesso do NAPNE aos usuários dele. Mesmo que se chame
-- Profissional NAPNE, ele e seus usuários vão para um id livre a partir de 100,
-- onde continuam sem permissão em nenhuma rota. A chave estrangeira
-- User_id_level_fkey é ON UPDATE CASCADE, então mudar o id do nível leva os
-- usuários junto.
--
-- O Prisma aplica a migration uma única vez, antes de o seed gravar o nível 5.
-- Executá-la de novo depois do seed moveria o NAPNE legítimo.
--
-- O seed grava o id 5 com o nome Profissional NAPNE, e o nome é único. Por isso
-- o nível que saiu do id 5 com esse nome, e qualquer outro nível com esse nome
-- em outro id, recebe o sufixo com o próprio id.
UPDATE "Level" SET id = (SELECT GREATEST(max(id) + 1, 100) FROM "Level") WHERE id = 5;
UPDATE "Level" SET name = name || ' (nível ' || id || ')' WHERE name = 'Profissional NAPNE' AND id <> 5;
