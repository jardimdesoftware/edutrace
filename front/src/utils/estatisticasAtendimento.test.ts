import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  montarPainel,
  ocupacaoDoProfissional,
  podeVerEstatisticas,
  textoDaEsperaMaisAntiga,
} from './estatisticasAtendimento';
import type { ProfessionalLoad, ServiceStats } from '../interfaces/ServiceStats';
import {
  ADMIN,
  ESTUDANTE,
  PROFISSIONAL_EDUCACAO,
  PROFISSIONAL_NAPNE,
  PROFISSIONAL_SAUDE,
} from '../consts';

process.env.TZ = 'UTC';

const AGORA = new Date('2026-10-16T15:00:00.000Z');

function profissional(extra: Partial<ProfessionalLoad> = {}): ProfessionalLoad {
  return { id: 7, full_name: 'Ana NAPNE', in_service: 2, capacity: 5, free: 3, ...extra };
}

describe('podeVerEstatisticas', () => {
  for (const [nivel, nome] of [
    [ADMIN, 'Administrador'],
    [PROFISSIONAL_NAPNE, 'Profissional NAPNE'],
  ] as const) {
    it(`allows ${nome}`, () => {
      assert.equal(podeVerEstatisticas(nivel), true);
    });
  }

  for (const [nivel, nome] of [
    [PROFISSIONAL_EDUCACAO, 'Profissional da Educação'],
    [PROFISSIONAL_SAUDE, 'Profissional da Saúde'],
    [ESTUDANTE, 'Estudante'],
  ] as const) {
    it(`denies ${nome}`, () => {
      assert.equal(podeVerEstatisticas(nivel), false);
    });
  }

  it('denies a level that does not exist', () => {
    assert.equal(podeVerEstatisticas(99), false);
  });
});

describe('textoDaEsperaMaisAntiga', () => {
  const fila = (oldest_queued_at: string | null, size = 3) => ({ size, oldest_queued_at });

  it('tells how many days the oldest student waits and since when', () => {
    assert.equal(
      textoDaEsperaMaisAntiga(fila('2026-10-13T12:00:00.000Z'), AGORA),
      'Espera mais antiga: há 3 dias (desde 13/10/2026)',
    );
  });

  it('uses the singular for one day, counted in full 24 hour periods', () => {
    assert.equal(
      textoDaEsperaMaisAntiga(fila('2026-10-15T15:00:00.000Z'), AGORA),
      'Espera mais antiga: há 1 dia (desde 15/10/2026)',
    );
    assert.equal(
      textoDaEsperaMaisAntiga(fila('2026-10-15T15:00:00.001Z'), AGORA),
      'Espera mais antiga: há menos de 1 dia (desde 15/10/2026)',
    );
  });

  it('shows the date in the Brazilian time zone, not in UTC', () => {
    assert.equal(
      textoDaEsperaMaisAntiga(fila('2026-10-14T01:30:00.000Z'), AGORA),
      'Espera mais antiga: há 2 dias (desde 13/10/2026)',
    );
  });

  it('never shows a negative wait when the entry is ahead of the clock', () => {
    assert.equal(
      textoDaEsperaMaisAntiga(fila('2026-10-17T15:00:00.000Z'), AGORA),
      'Espera mais antiga: há menos de 1 dia (desde 17/10/2026)',
    );
  });

  it('says nobody is waiting when the queue is empty', () => {
    assert.equal(textoDaEsperaMaisAntiga(fila(null, 0), AGORA), 'Ninguém aguardando');
  });

  it('says the date is missing when there is a queue without an entry date', () => {
    assert.equal(textoDaEsperaMaisAntiga(fila(null), AGORA), 'Data de entrada não registrada');
    assert.equal(
      textoDaEsperaMaisAntiga(fila('data-invalida'), AGORA),
      'Data de entrada não registrada',
    );
  });
});

describe('ocupacaoDoProfissional', () => {
  it('shows the students in service against the limit and the free slots', () => {
    assert.deepEqual(ocupacaoDoProfissional(profissional()), {
      id: 7,
      nome: 'Ana NAPNE',
      ocupacao: '2 de 5',
      vagas: '3',
      situacao: 'COM_VAGAS',
      rotuloSituacao: 'Com vagas',
      percentual: 40,
    });
  });

  it('flags the professional with no free slot as at the limit', () => {
    const resultado = ocupacaoDoProfissional(profissional({ in_service: 5, free: 0 }));

    assert.equal(resultado.ocupacao, '5 de 5');
    assert.equal(resultado.vagas, '0');
    assert.equal(resultado.situacao, 'NO_LIMITE');
    assert.equal(resultado.rotuloSituacao, 'No limite');
    assert.equal(resultado.percentual, 100);
  });

  it('keeps the real count and caps the bar when the limit was lowered below it', () => {
    const resultado = ocupacaoDoProfissional(profissional({ in_service: 6, capacity: 4, free: 0 }));

    assert.equal(resultado.ocupacao, '6 de 4');
    assert.equal(resultado.situacao, 'NO_LIMITE');
    assert.equal(resultado.percentual, 100);
  });

  it('treats a limit of zero as at the limit without dividing by zero', () => {
    const resultado = ocupacaoDoProfissional(profissional({ in_service: 0, capacity: 0, free: 0 }));

    assert.equal(resultado.ocupacao, '0 de 0');
    assert.equal(resultado.situacao, 'NO_LIMITE');
    assert.equal(resultado.percentual, 100);
  });

  it('does not flag a professional whose limit is not defined as at the limit', () => {
    const resultado = ocupacaoDoProfissional(
      profissional({ in_service: 0, capacity: null, free: null }),
    );

    assert.equal(resultado.ocupacao, 'Limite não definido');
    assert.equal(resultado.vagas, 'Não definidas');
    assert.equal(resultado.situacao, 'SEM_LIMITE');
    assert.equal(resultado.rotuloSituacao, 'Aguardando limite');
    assert.equal(resultado.percentual, null);
  });
});

describe('montarPainel', () => {
  const estatisticas: ServiceStats = {
    totals: { WAITING: 3, IN_SERVICE: 4, CLOSED: 5 },
    professionals: [
      profissional(),
      profissional({ id: 8, full_name: 'Bia NAPNE', in_service: 5, free: 0 }),
      profissional({ id: 9, full_name: 'Caio NAPNE', in_service: 0, capacity: null, free: null }),
    ],
    queue: { size: 3, oldest_queued_at: '2026-10-13T12:00:00.000Z' },
  };

  it('lists the three totals with the status names of the student list', () => {
    const { totais } = montarPainel(estatisticas, AGORA);

    assert.deepEqual(
      totais.map(({ status, rotulo, valor }) => [status, rotulo, valor]),
      [
        ['WAITING', 'Fila de espera', 3],
        ['IN_SERVICE', 'Em atendimento', 4],
        ['CLOSED', 'Encerrado', 5],
      ],
    );
  });

  it('puts the wait of the oldest student only on the waiting queue total', () => {
    const { totais } = montarPainel(estatisticas, AGORA);

    assert.deepEqual(
      totais.map(({ detalhe }) => detalhe),
      ['Espera mais antiga: há 3 dias (desde 13/10/2026)', null, null],
    );
  });

  it('keeps the professionals in the order the API sent', () => {
    const { profissionais } = montarPainel(estatisticas, AGORA);

    assert.deepEqual(
      profissionais.map(({ nome, situacao }) => [nome, situacao]),
      [
        ['Ana NAPNE', 'COM_VAGAS'],
        ['Bia NAPNE', 'NO_LIMITE'],
        ['Caio NAPNE', 'SEM_LIMITE'],
      ],
    );
  });

  it('keeps an empty panel readable when there is no student and no professional', () => {
    const painel = montarPainel(
      {
        totals: { WAITING: 0, IN_SERVICE: 0, CLOSED: 0 },
        professionals: [],
        queue: { size: 0, oldest_queued_at: null },
      },
      AGORA,
    );

    assert.deepEqual(painel.profissionais, []);
    assert.deepEqual(
      painel.totais.map(({ valor, detalhe }) => [valor, detalhe]),
      [[0, 'Ninguém aguardando'], [0, null], [0, null]],
    );
  });
});
