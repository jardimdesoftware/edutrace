import { CommentType, Prisma } from '@prisma/client';
import {
  authorsSql,
  countsSql,
  pageIdsSql,
  statementTimeoutSql,
} from 'src/comments/comments-list.sql';
import { ListCommentsQueryDto } from 'src/comments/dto/list-comments-query.dto';

const STUDENT = 10;

const query = (fields: Partial<ListCommentsQueryDto>) =>
  Object.assign(new ListCommentsQueryDto(), fields);

const INJECTIONS = [
  `x'); DROP TABLE "Comments"; --`,
  `' OR 1=1 --`,
  `"; SELECT pg_sleep(10); --`,
  `\${1}`,
  `$1; SELECT 1`,
  `?`,
  `%`,
  `a_b`,
];

function expectOnlyBound(sql: Prisma.Sql, value: unknown) {
  expect(sql.values).toContain(value);
  expect(sql.text).not.toContain(String(value));
}

describe('SQL da lista de anotações', () => {
  describe('statementTimeoutSql', () => {
    it('should limit only the transaction in course, with SET LOCAL and the 3 seconds in milliseconds', () => {
      const sql = statementTimeoutSql();

      expect(sql.text).toBe('SET LOCAL statement_timeout = 3000');
      expect(sql.values).toEqual([]);
    });
  });

  describe('countsSql', () => {
    it('should count the whole record of the student and the matching rows in one statement', () => {
      const sql = countsSql(STUDENT, query({}));

      expect(sql.text).toContain('count(*)::int AS overall');
      expect(sql.text).toContain('FILTER (WHERE true)');
      expect(sql.text).toContain('WHERE c."id_user" = $1');
      expect(sql.values).toEqual([STUDENT]);
    });

    it('should apply the filters to the total and never to the overall', () => {
      const sql = countsSql(STUDENT, query({ author: 7, cursor: 50 }));

      expect(sql.text).toMatch(/FILTER \(WHERE c\."id_author" = \$\d\)/);
      expect(sql.text).toMatch(/WHERE c\."id_user" = \$\d$/);
      expect(sql.values).toEqual(expect.arrayContaining([STUDENT, 7]));
    });

    it('should leave the cursor out, because the total does not depend on the page', () => {
      const sql = countsSql(STUDENT, query({ cursor: 50 }));

      expect(sql.values).toEqual([STUDENT]);
      expect(sql.text).not.toContain('c."id" <');
    });
  });

  describe('pageIdsSql', () => {
    it('should select the ids of the student from the newest, asking for one more than the limit', () => {
      const sql = pageIdsSql(STUDENT, query({}), 20);

      expect(sql.text).toContain('SELECT c."id" FROM "Comments" c');
      expect(sql.text).toContain('c."id_user" = $1');
      expect(sql.text).toMatch(/ORDER BY c\."id" DESC LIMIT \$2$/);
      expect(sql.values).toEqual([STUDENT, 21]);
    });

    it('should bound the page by the cursor, exclusive', () => {
      const sql = pageIdsSql(STUDENT, query({ cursor: 123 }), 5);

      expect(sql.text).toMatch(/AND c\."id" < \$\d/);
      expect(sql.values).toEqual(expect.arrayContaining([STUDENT, 123, 6]));
    });

    it('should not bound the page when there is no cursor', () => {
      expect(pageIdsSql(STUDENT, query({}), 5).text).not.toContain('c."id" <');
    });

    it('should filter by author and by type with bound parameters', () => {
      const sql = pageIdsSql(
        STUDENT,
        query({ author: 7, type: CommentType.CLASS_COUNCIL_REPORT }),
        5,
      );

      expect(sql.text).toContain('c."id_author" = $2');
      expect(sql.text).toContain('c."type" = $3::"CommentType"');
      expect(sql.values).toEqual([
        STUDENT,
        7,
        CommentType.CLASS_COUNCIL_REPORT,
        6,
      ]);
    });

    it('should filter the area by the current level of the author', () => {
      const sql = pageIdsSql(STUDENT, query({ area: 4 }), 5);

      expect(sql.text).toContain(
        'EXISTS (SELECT 1 FROM "User" u WHERE u."id" = c."id_author" AND $2 = ANY(u."roles"))',
      );
      expect(sql.values).toEqual([STUDENT, 4, 6]);
    });

    it('should filter the edited records by the existence of an edit', () => {
      const sql = pageIdsSql(STUDENT, query({ edited: true }), 5);

      expect(sql.text).toContain(
        'EXISTS (SELECT 1 FROM "CommentEdits" e WHERE e."id_comment" = c."id")',
      );
    });

    it('should not filter when edited is false', () => {
      const sql = pageIdsSql(STUDENT, query({ edited: false }), 5);

      expect(sql.text).not.toContain('CommentEdits');
      expect(sql.values).toEqual([STUDENT, 6]);
    });

    it('should compare the dates as UTC instants, whatever the offset the client sent', () => {
      const sql = pageIdsSql(
        STUDENT,
        query({
          from: '2026-10-17T00:00:00-03:00',
          to: '2026-10-18T05:30:00+05:30',
        }),
        5,
      );

      expect(sql.text).toContain(
        `c."created_at" >= ($2::timestamptz AT TIME ZONE 'UTC')`,
      );
      expect(sql.text).toContain(
        `c."created_at" < ($3::timestamptz AT TIME ZONE 'UTC')`,
      );
      expect(sql.values).toEqual([
        STUDENT,
        '2026-10-17T03:00:00.000Z',
        '2026-10-18T00:00:00.000Z',
        6,
      ]);
    });

    it('should search with strpos over the text and the author name, both normalized with the term', () => {
      const sql = pageIdsSql(STUDENT, query({ q: 'Ação' }), 5);

      expect(sql.text).toContain('strpos(');
      expect(sql.text).not.toMatch(/\bi?like\b/i);
      expect(sql.text).toContain('c."comment"');
      expect(sql.text).toContain('c."author_name"');
      expect(sql.text.match(/normalize\(/g)).toHaveLength(4);
      expect(sql.text.match(/NFD/g)).toHaveLength(4);
      expect(sql.values).toEqual([STUDENT, 'Ação', 'Ação', 6]);
    });

    it('should not search when the term is empty', () => {
      const sql = pageIdsSql(STUDENT, query({ q: '' }), 5);

      expect(sql.text).not.toContain('strpos');
      expect(sql.values).toEqual([STUDENT, 6]);
    });

    it('should combine every filter with AND and keep the student scope first', () => {
      const sql = pageIdsSql(
        STUDENT,
        query({
          q: 'x',
          author: 7,
          area: 3,
          type: CommentType.NOTE,
          from: '2026-10-17T03:00:00.000Z',
          to: '2026-10-18T03:00:00.000Z',
          edited: true,
          cursor: 99,
        }),
        10,
      );

      expect(sql.text.indexOf('c."id_user" = $1')).toBeLessThan(
        sql.text.indexOf('strpos'),
      );
      expect(sql.text).toContain('c."id" < ');
      expect(sql.values).toHaveLength(10);
    });

    it.each(INJECTIONS)(
      'should bind the term %j as a parameter and never write it in the statement',
      (term) => {
        expectOnlyBound(pageIdsSql(STUDENT, query({ q: term }), 5), term);
        expectOnlyBound(countsSql(STUDENT, query({ q: term })), term);
      },
    );
  });

  describe('authorsSql', () => {
    it('should take the latest name of each author among all the records of the student', () => {
      const sql = authorsSql(STUDENT);

      expect(sql.text).toContain('DISTINCT ON (c."id_author")');
      expect(sql.text).toContain('c."id_user" = $1');
      expect(sql.text).toContain('ORDER BY c."id_author", c."id" DESC');
      expect(sql.values).toEqual([STUDENT]);
    });
  });
});
