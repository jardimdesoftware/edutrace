import { Prisma } from '@prisma/client';
import { COMMENT_LIST_STATEMENT_TIMEOUT_MS } from 'src/constants';
import { ListCommentsQueryDto } from './dto/list-comments-query.dto';

function normalizedText(text: Prisma.Sql): Prisma.Sql {
  return Prisma.sql`lower(regexp_replace(normalize(${text}, NFD), '[\\u0300-\\u036f]', '', 'g'))`;
}

function searchCondition(term: string): Prisma.Sql {
  const normalizedTerm = normalizedText(Prisma.sql`${term}::text`);

  return Prisma.sql`(strpos(${normalizedText(Prisma.sql`c."comment"`)}, ${normalizedTerm}) > 0 OR strpos(${normalizedText(Prisma.sql`c."author_name"`)}, ${normalizedTerm}) > 0)`;
}

function utcInstant(isoDateTime: string): Prisma.Sql {
  const instant = new Date(isoDateTime).toISOString();

  return Prisma.sql`(${instant}::timestamptz AT TIME ZONE 'UTC')`;
}

function filterConditions(query: ListCommentsQueryDto): Prisma.Sql[] {
  const conditions: Prisma.Sql[] = [];

  if (query.q) {
    conditions.push(searchCondition(query.q));
  }
  if (query.author !== undefined) {
    conditions.push(Prisma.sql`c."id_author" = ${query.author}`);
  }
  if (query.area !== undefined) {
    conditions.push(
      Prisma.sql`EXISTS (SELECT 1 FROM "User" u WHERE u."id" = c."id_author" AND ${query.area} = ANY(u."roles"))`,
    );
  }
  if (query.type !== undefined) {
    conditions.push(Prisma.sql`c."type" = ${query.type}::"CommentType"`);
  }
  if (query.from !== undefined) {
    conditions.push(Prisma.sql`c."created_at" >= ${utcInstant(query.from)}`);
  }
  if (query.to !== undefined) {
    conditions.push(Prisma.sql`c."created_at" < ${utcInstant(query.to)}`);
  }
  if (query.edited) {
    conditions.push(
      Prisma.sql`EXISTS (SELECT 1 FROM "CommentEdits" e WHERE e."id_comment" = c."id")`,
    );
  }

  return conditions;
}

export function statementTimeoutSql(): Prisma.Sql {
  return Prisma.sql`SET LOCAL statement_timeout = ${Prisma.raw(`${COMMENT_LIST_STATEMENT_TIMEOUT_MS}`)}`;
}

export function countsSql(
  idUser: number,
  query: ListCommentsQueryDto,
): Prisma.Sql {
  const conditions = filterConditions(query);
  const matching =
    conditions.length === 0
      ? Prisma.sql`true`
      : Prisma.join(conditions, ' AND ');

  return Prisma.sql`SELECT count(*)::int AS overall, (count(*) FILTER (WHERE ${matching}))::int AS total FROM "Comments" c WHERE c."id_user" = ${idUser}`;
}

export function pageIdsSql(
  idUser: number,
  query: ListCommentsQueryDto,
  limit: number,
): Prisma.Sql {
  const conditions = filterConditions(query);
  const filters =
    conditions.length === 0
      ? Prisma.empty
      : Prisma.sql`AND ${Prisma.join(conditions, ' AND ')}`;
  const afterCursor =
    query.cursor === undefined
      ? Prisma.empty
      : Prisma.sql`AND c."id" < ${query.cursor}`;

  return Prisma.sql`SELECT c."id" FROM "Comments" c WHERE c."id_user" = ${idUser} ${filters} ${afterCursor} ORDER BY c."id" DESC LIMIT ${limit + 1}`;
}

export function authorsSql(idUser: number): Prisma.Sql {
  return Prisma.sql`SELECT DISTINCT ON (c."id_author") c."id_author" AS id, c."author_name" AS name FROM "Comments" c WHERE c."id_user" = ${idUser} ORDER BY c."id_author", c."id" DESC`;
}
