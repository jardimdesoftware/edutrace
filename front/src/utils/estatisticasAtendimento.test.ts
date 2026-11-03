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
  PROFESSOR_AEE,
} from '../consts';

process.env.TZ = 'UTC';

const AGORA = new Date('2026-10-16T15:00:00.000Z');

function profissional(extra: Partial<ProfessionalLoad> = {}): ProfessionalLoad {
  return { id: 7, full_name: 'Ana AEE', in_service: 2, capacity: 15, free: 13, ...extra };
}

describe('podeVerEstatisticas', () => {
  for (const [nivel, nome] of [
    [PROFISSIONAL_NAPNE, 'Profissional NAPNE'],
  ] as const) {
    it(`allows ${nome}`, () => {
      assert.equal(podeVerEstatisticas([nivel]), true);
    });
  }

  for (const [nivel, nome] of [
    [ADMIN, 'Administrador'],
    [PROFISSIONAL_EDUCACAO, 'Profissional da Educação'],
    [PROFISSIONAL_SAUDE, 'Profissional da Saúde'],
    [ESTUDANTE, 'Estudante'],
  ] as const) {
    it(`denies ${nome}`, () => {
      assert.equal(podeVerEstatisticas([nivel]), false);
    });
  }

  it('denies the AEE teacher alone, who does not see the stats', () => {
    assert.equal(podeVerEstatisticas([PROFESSOR_AEE]), false);
  });

  it('keeps the panel for NAPNE plus AEE', () => {
    assert.equal(podeVerEstatisticas([PROFISSIONAL_NAPNE, PROFESSOR_AEE]), true);
  });

  it('denies a level that does not exist', () => {
    assert.equal(podeVerEstatisticas([99]), false);
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
  it('shows the students in service against the limit and the free slots sent by the API', () => {
    assert.deepEqual(ocupacaoDoProfissional(profissional()), {
      id: 7,
      nome: 'Ana AEE',
      ocupacao: '2 de 15',
      vagas: '13',
      situacao: 'COM_VAGAS',
      rotuloSituacao: 'Com vagas',
      percentual: 13,
    });
  });

  it('flags the teacher with 15 in service as at the limit', () => {
    const resultado = ocupacaoDoProfissional(profissional({ in_service: 15, free: 0 }));

    assert.equal(resultado.ocupacao, '15 de 15');
    assert.equal(resultado.vagas, '0');
    assert.equal(resultado.situacao, 'NO_LIMITE');
    assert.equal(resultado.rotuloSituacao, 'No limite');
    assert.equal(resultado.percentual, 100);
  });

  it('keeps 14 in service with one free slot', () => {
    const resultado = ocupacaoDoProfissional(profissional({ in_service: 14, free: 1 }));

    assert.equal(resultado.vagas, '1');
    assert.equal(resultado.situacao, 'COM_VAGAS');
  });

  it('keeps the real count and caps the bar and the free slots when above 15', () => {
    const resultado = ocupacaoDoProfissional(profissional({ in_service: 17, free: -2 }));

    assert.equal(resultado.ocupacao, '17 de 15');
    assert.equal(resultado.vagas, '0');
    assert.equal(resultado.situacao, 'NO_LIMITE');
    assert.equal(resultado.percentual, 100);
  });

  it('follows the capacity sent by the API when it is not 15', () => {
    const resultado = ocupacaoDoProfissional(profissional({ in_service: 5, capacity: 20, free: 15 }));

    assert.equal(resultado.ocupacao, '5 de 20');
    assert.equal(resultado.vagas, '15');
    assert.equal(resultado.situacao, 'COM_VAGAS');
    assert.equal(resultado.percentual, 25);
  });
});

describe('montarPainel', () => {
  const estatisticas: ServiceStats = {
    totals: { WAITING: 3, IN_SERVICE: 4, CLOSED: 5 },
    professionals: [
      profissional(),
      profissional({ id: 8, full_name: 'Bia AEE', in_service: 15, free: 0 }),
      profissional({ id: 9, full_name: 'Caio AEE', in_service: 0, free: 15 }),
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
        ['Ana AEE', 'COM_VAGAS'],
        ['Bia AEE', 'NO_LIMITE'],
        ['Caio AEE', 'COM_VAGAS'],
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
