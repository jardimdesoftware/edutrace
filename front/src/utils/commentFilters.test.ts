import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { AREAS, FILTROS_VAZIOS, filtrarAnotacoes } from './commentFilters';
import type { CommentData } from '../interfaces/CommentData';
import { PROFISSIONAL_NAPNE } from '../consts';

function anotacao(id: number, nivelDoAutor: number): CommentData {
  return {
    id,
    id_user: 100,
    id_author: id,
    author_name: `Autor ${id}`,
    author_level: nivelDoAutor,
    comment: `Anotação ${id}`,
    created_at: new Date('2026-10-01T12:00:00'),
  };
}

describe('AREAS', () => {
  it('has the NAPNE area on level 5', () => {
    assert.deepEqual(
      AREAS.find((area) => area.nivel === PROFISSIONAL_NAPNE),
      { nivel: 5, nome: 'NAPNE' },
    );
  });
});

describe('filtrarAnotacoes', () => {
  it('keeps only the notes whose author is on the NAPNE level when filtering by area 5', () => {
    const anotacoes = [anotacao(1, 4), anotacao(2, 5), anotacao(3, 3), anotacao(4, 5)];

    const filtradas = filtrarAnotacoes(anotacoes, { ...FILTROS_VAZIOS, area: PROFISSIONAL_NAPNE });

    assert.deepEqual(
      filtradas.map((item) => item.id),
      [2, 4],
    );
  });

  it('keeps every note when no area is selected', () => {
    const anotacoes = [anotacao(1, 4), anotacao(2, 5)];

    assert.equal(filtrarAnotacoes(anotacoes, FILTROS_VAZIOS).length, 2);
  });
});
