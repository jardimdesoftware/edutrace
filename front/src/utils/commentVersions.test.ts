import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildPreviousVersions, lastEditedAt } from './commentVersions';

const criacao = '2026-09-10T14:00:00.000Z';

function edicao(id: number, comment: string, created_at: string) {
  return { id, comment, created_at: created_at as unknown as Date };
}

function anotacao(edits: ReturnType<typeof edicao>[] | undefined) {
  return { created_at: criacao as unknown as Date, edits };
}

describe('buildPreviousVersions', () => {
  it('returns no versions when the comment was never edited', () => {
    assert.deepEqual(buildPreviousVersions(anotacao([])), []);
    assert.deepEqual(buildPreviousVersions(anotacao(undefined)), []);
  });

  it('dates the original version with the comment creation', () => {
    const versoes = buildPreviousVersions(
      anotacao([edicao(1, 'texto original', '2026-09-11T10:00:00.000Z')]),
    );

    assert.deepEqual(versoes, [
      { numero: 1, texto: 'texto original', escritaEm: criacao, original: true },
    ]);
  });

  it('lists versions from the newest to the original, each dated when it was written', () => {
    const versoes = buildPreviousVersions(
      anotacao([
        edicao(1, 'versão 1', '2026-09-11T10:00:00.000Z'),
        edicao(2, 'versão 2', '2026-09-12T09:00:00.000Z'),
        edicao(3, 'versão 3', '2026-09-13T08:00:00.000Z'),
      ]),
    );

    assert.deepEqual(versoes, [
      {
        numero: 3,
        texto: 'versão 3',
        escritaEm: '2026-09-12T09:00:00.000Z',
        original: false,
      },
      {
        numero: 2,
        texto: 'versão 2',
        escritaEm: '2026-09-11T10:00:00.000Z',
        original: false,
      },
      { numero: 1, texto: 'versão 1', escritaEm: criacao, original: true },
    ]);
  });

  it('does not depend on the order the edits arrive from the API', () => {
    const versoes = buildPreviousVersions(
      anotacao([
        edicao(2, 'versão 2', '2026-09-12T09:00:00.000Z'),
        edicao(1, 'versão 1', '2026-09-11T10:00:00.000Z'),
      ]),
    );

    assert.deepEqual(
      versoes.map((versao) => versao.texto),
      ['versão 2', 'versão 1'],
    );
    assert.equal(versoes[0].escritaEm, '2026-09-11T10:00:00.000Z');
  });
});

describe('lastEditedAt', () => {
  it('returns null when the comment was never edited', () => {
    assert.equal(lastEditedAt(anotacao([])), null);
    assert.equal(lastEditedAt(anotacao(undefined)), null);
  });

  it('returns the date of the most recent edit', () => {
    const resultado = lastEditedAt(
      anotacao([
        edicao(2, 'versão 2', '2026-09-12T09:00:00.000Z'),
        edicao(1, 'versão 1', '2026-09-11T10:00:00.000Z'),
      ]),
    );

    assert.equal(resultado, '2026-09-12T09:00:00.000Z');
  });
});
