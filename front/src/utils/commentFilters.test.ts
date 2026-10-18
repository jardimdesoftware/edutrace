import { after, before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  AREAS,
  ERRO_DE_MARCAS_NA_BUSCA,
  FILTROS_VAZIOS,
  erroDaBusca,
  filtrosAtivos,
  limparBusca,
  montarConsulta,
  proximaBusca,
} from './commentFilters';
import { PROFISSIONAL_NAPNE } from '../consts';

const ACENTO_AGUDO = String.fromCodePoint(0x0301);
const marcas = (quantas: number) => `a${ACENTO_AGUDO.repeat(quantas)}`;

// Os parâmetros que GET /comments/:id_user aceita; qualquer outro vira 400.
const PARAMETROS_DO_CONTRATO = [
  'q',
  'author',
  'area',
  'type',
  'from',
  'to',
  'edited',
  'cursor',
  'limit',
];

describe('AREAS', () => {
  it('has the NAPNE area on level 5', () => {
    assert.deepEqual(
      AREAS.find((area) => area.nivel === PROFISSIONAL_NAPNE),
      { nivel: 5, nome: 'NAPNE' },
    );
  });
});

describe('montarConsulta', () => {
  it('sends no parameter for the empty filters', () => {
    assert.deepEqual(montarConsulta(FILTROS_VAZIOS), {});
  });

  it('turns the text search into q, without the spaces around it', () => {
    assert.deepEqual(montarConsulta({ ...FILTROS_VAZIOS, busca: '  Ação do João \n' }), {
      q: 'Ação do João',
    });
  });

  it('keeps the accents and the case of the search, because the API normalizes them', () => {
    assert.equal(montarConsulta({ ...FILTROS_VAZIOS, busca: 'ÁÇÃO' }).q, 'ÁÇÃO');
  });

  it('turns every control character of the search into a space before the trim', () => {
    assert.equal(
      montarConsulta({ ...FILTROS_VAZIOS, busca: 'Ana\tSilva\u0000Souza\u0085Lima' }).q,
      'Ana Silva Souza Lima',
    );
    assert.equal(montarConsulta({ ...FILTROS_VAZIOS, busca: '\t\tAna\u000b' }).q, 'Ana');
  });

  it('omits q when the search is only controls', () => {
    assert.equal('q' in montarConsulta({ ...FILTROS_VAZIOS, busca: '\u0007\t\u0000' }), false);
  });

  it('does not send a search with more than 30 combining marks in a row', () => {
    assert.equal('q' in montarConsulta({ ...FILTROS_VAZIOS, busca: marcas(31) }), false);
  });

  it('sends a search with exactly 30 combining marks in a row', () => {
    assert.equal(montarConsulta({ ...FILTROS_VAZIOS, busca: marcas(30) }).q, marcas(30));
  });

  it('omits q when the search is empty or only spaces', () => {
    assert.equal('q' in montarConsulta({ ...FILTROS_VAZIOS, busca: '' }), false);
    assert.equal('q' in montarConsulta({ ...FILTROS_VAZIOS, busca: '   \t ' }), false);
  });

  it('turns idAutor into author', () => {
    assert.deepEqual(montarConsulta({ ...FILTROS_VAZIOS, idAutor: 7 }), { author: 7 });
  });

  it('turns area into area, with the level number', () => {
    assert.deepEqual(montarConsulta({ ...FILTROS_VAZIOS, area: PROFISSIONAL_NAPNE }), {
      area: 5,
    });
  });

  it('turns tipo into type, with the enum string', () => {
    assert.deepEqual(montarConsulta({ ...FILTROS_VAZIOS, tipo: 'NOTE' }), { type: 'NOTE' });
    assert.deepEqual(montarConsulta({ ...FILTROS_VAZIOS, tipo: 'CLASS_COUNCIL_REPORT' }), {
      type: 'CLASS_COUNCIL_REPORT',
    });
  });

  it('turns soEditadas into edited=true and omits it when false', () => {
    assert.deepEqual(montarConsulta({ ...FILTROS_VAZIOS, soEditadas: true }), { edited: true });
    assert.equal('edited' in montarConsulta({ ...FILTROS_VAZIOS, soEditadas: false }), false);
  });

  it('turns de into from at the local midnight of the day', () => {
    assert.deepEqual(montarConsulta({ ...FILTROS_VAZIOS, de: '2026-10-01' }), {
      from: new Date(2026, 9, 1).toISOString(),
    });
  });

  it('turns ate into to at the local midnight of the NEXT day, so the whole day is included', () => {
    assert.deepEqual(montarConsulta({ ...FILTROS_VAZIOS, ate: '2026-10-01' }), {
      to: new Date(2026, 9, 2).toISOString(),
    });
  });

  it('moves ate over the end of the month, of the year and of February in a leap year', () => {
    const para = (ate: string) => montarConsulta({ ...FILTROS_VAZIOS, ate }).to;

    assert.equal(para('2026-10-31'), new Date(2026, 10, 1).toISOString());
    assert.equal(para('2026-12-31'), new Date(2027, 0, 1).toISOString());
    assert.equal(para('2028-02-28'), new Date(2028, 1, 29).toISOString());
    assert.equal(para('2028-02-29'), new Date(2028, 2, 1).toISOString());
    assert.equal(para('2027-02-28'), new Date(2027, 2, 1).toISOString());
  });

  it('omits from and to when the date is empty or is not a real day', () => {
    for (const data of ['', 'ontem', '2026-1-1', '2026-13-01', '2026-02-30', '2026-10-32']) {
      const consulta = montarConsulta({ ...FILTROS_VAZIOS, de: data, ate: data });

      assert.deepEqual(consulta, {}, `a data "${data}" não devia gerar parâmetro`);
    }
  });

  describe('with a year the API does not accept (it takes years 1000 to 9999)', () => {
    let fusoOriginal: string | undefined;

    before(() => {
      fusoOriginal = process.env.TZ;
    });

    beforeEach(() => {
      process.env.TZ = 'Etc/GMT+3';
    });

    after(() => {
      if (fusoOriginal === undefined) delete process.env.TZ;
      else process.env.TZ = fusoOriginal;
    });

    it('omits from when the year is 2, which the API refuses', () => {
      assert.deepEqual(montarConsulta({ ...FILTROS_VAZIOS, de: '0002-10-17' }), {});
    });

    it('omits to when the day after is in the year 10000', () => {
      assert.deepEqual(montarConsulta({ ...FILTROS_VAZIOS, ate: '9999-12-31' }), {});
    });

    it('omits only the filter that is out of range and keeps the other one', () => {
      assert.deepEqual(
        montarConsulta({ ...FILTROS_VAZIOS, de: '0002-10-17', ate: '2026-10-01' }),
        { to: '2026-10-02T03:00:00.000Z' },
      );
      assert.deepEqual(
        montarConsulta({ ...FILTROS_VAZIOS, de: '2026-10-01', ate: '9999-12-31' }),
        { from: '2026-10-01T03:00:00.000Z' },
      );
    });

    it('sends the first and the last day the API accepts', () => {
      assert.deepEqual(
        montarConsulta({ ...FILTROS_VAZIOS, de: '1000-01-01', ate: '9999-12-30' }),
        { from: '1000-01-01T03:00:00.000Z', to: '9999-12-31T03:00:00.000Z' },
      );
    });

    it('omits the years 0 to 999, whatever the zero padding', () => {
      for (const ano of ['0000', '0001', '0999']) {
        assert.deepEqual(montarConsulta({ ...FILTROS_VAZIOS, de: `${ano}-06-15` }), {});
      }
    });

    it('judges the instant that is sent: a zone ahead of UTC pushes 1000-01-01 into the year 999', () => {
      process.env.TZ = 'Etc/GMT-9';

      assert.deepEqual(montarConsulta({ ...FILTROS_VAZIOS, de: '1000-01-01' }), {});
      assert.deepEqual(montarConsulta({ ...FILTROS_VAZIOS, de: '1000-01-02' }), {
        from: '1000-01-01T15:00:00.000Z',
      });
    });

    it('judges the instant that is sent: a zone ahead of UTC still sends 9999-12-31', () => {
      process.env.TZ = 'Etc/GMT-9';

      assert.deepEqual(montarConsulta({ ...FILTROS_VAZIOS, ate: '9999-12-31' }), {
        to: '9999-12-31T15:00:00.000Z',
      });
    });
  });

  it('sends the cursor and the limit only when they come', () => {
    assert.deepEqual(montarConsulta(FILTROS_VAZIOS, { cursor: 123 }), { cursor: 123 });
    assert.deepEqual(montarConsulta(FILTROS_VAZIOS, { limit: 50 }), { limit: 50 });
    assert.deepEqual(montarConsulta(FILTROS_VAZIOS, { cursor: 123, limit: 20 }), {
      cursor: 123,
      limit: 20,
    });
    assert.deepEqual(montarConsulta(FILTROS_VAZIOS, {}), {});
  });

  it('combines every filter with the page into the exact query of the contract', () => {
    const consulta = montarConsulta(
      {
        busca: ' acao ',
        idAutor: 7,
        area: 3,
        tipo: 'CLASS_COUNCIL_REPORT',
        de: '2026-09-01',
        ate: '2026-09-30',
        soEditadas: true,
      },
      { cursor: 90, limit: 20 },
    );

    assert.deepEqual(consulta, {
      q: 'acao',
      author: 7,
      area: 3,
      type: 'CLASS_COUNCIL_REPORT',
      from: new Date(2026, 8, 1).toISOString(),
      to: new Date(2026, 9, 1).toISOString(),
      edited: true,
      cursor: 90,
      limit: 20,
    });
  });

  it('never sends a key outside the contract', () => {
    const consulta = montarConsulta(
      {
        busca: 'texto',
        idAutor: 1,
        area: 1,
        tipo: 'NOTE',
        de: '2026-01-01',
        ate: '2026-12-31',
        soEditadas: true,
      },
      { cursor: 1, limit: 1 },
    );

    for (const chave of Object.keys(consulta)) {
      assert.ok(PARAMETROS_DO_CONTRATO.includes(chave), `a chave "${chave}" não é do contrato`);
    }
    assert.deepEqual(Object.keys(consulta).sort(), [...PARAMETROS_DO_CONTRATO].sort());
  });

  it('does not touch the filters it receives', () => {
    const filtros = Object.freeze({ ...FILTROS_VAZIOS, busca: ' x ', de: '2026-01-01' });

    assert.doesNotThrow(() => montarConsulta(filtros));
    assert.equal(filtros.busca, ' x ');
  });

  describe('with the clock of another time zone', () => {
    let fusoOriginal: string | undefined;

    before(() => {
      fusoOriginal = process.env.TZ;
    });

    after(() => {
      if (fusoOriginal === undefined) delete process.env.TZ;
      else process.env.TZ = fusoOriginal;
    });

    it('uses the midnight of the local day, not the UTC one (UTC-3)', () => {
      process.env.TZ = 'Etc/GMT+3';

      assert.deepEqual(
        montarConsulta({ ...FILTROS_VAZIOS, de: '2026-10-01', ate: '2026-10-01' }),
        { from: '2026-10-01T03:00:00.000Z', to: '2026-10-02T03:00:00.000Z' },
      );
    });

    it('uses the midnight of the local day to the east of UTC too (UTC+9)', () => {
      process.env.TZ = 'Etc/GMT-9';

      assert.deepEqual(
        montarConsulta({ ...FILTROS_VAZIOS, de: '2026-10-01', ate: '2026-10-01' }),
        { from: '2026-09-30T15:00:00.000Z', to: '2026-10-01T15:00:00.000Z' },
      );
    });

    it('moves to the next calendar day, not 24 hours, on the day the clock changes', () => {
      process.env.TZ = 'America/New_York';

      // Em 8 de março de 2026 o relógio avança 1 hora, então o dia tem 23 horas.
      assert.deepEqual(
        montarConsulta({ ...FILTROS_VAZIOS, de: '2026-03-08', ate: '2026-03-08' }),
        { from: '2026-03-08T05:00:00.000Z', to: '2026-03-09T04:00:00.000Z' },
      );
    });
  });
});

describe('filtrosAtivos', () => {
  it('is false for the empty filters', () => {
    assert.equal(filtrosAtivos(FILTROS_VAZIOS), false);
  });

  it('is true when only the type is selected', () => {
    assert.equal(filtrosAtivos({ ...FILTROS_VAZIOS, tipo: 'NOTE' }), true);
    assert.equal(filtrosAtivos({ ...FILTROS_VAZIOS, tipo: 'CLASS_COUNCIL_REPORT' }), true);
  });

  it('is true for each of the other filters alone', () => {
    assert.equal(filtrosAtivos({ ...FILTROS_VAZIOS, busca: 'texto' }), true);
    assert.equal(filtrosAtivos({ ...FILTROS_VAZIOS, idAutor: 1 }), true);
    assert.equal(filtrosAtivos({ ...FILTROS_VAZIOS, area: 3 }), true);
    assert.equal(filtrosAtivos({ ...FILTROS_VAZIOS, de: '2026-10-01' }), true);
    assert.equal(filtrosAtivos({ ...FILTROS_VAZIOS, ate: '2026-10-01' }), true);
    assert.equal(filtrosAtivos({ ...FILTROS_VAZIOS, soEditadas: true }), true);
  });

  it('ignores a search made only of spaces', () => {
    assert.equal(filtrosAtivos({ ...FILTROS_VAZIOS, busca: '   ' }), false);
  });

  it('ignores a search made only of control characters, which are not sent', () => {
    assert.equal(filtrosAtivos({ ...FILTROS_VAZIOS, busca: '\u0007\t\u0000' }), false);
  });
});

describe('limparBusca', () => {
  it('turns each control character into a space and trims the ends', () => {
    assert.equal(limparBusca('  Ana\tSilva\u0000 '), 'Ana Silva');
  });

  it('turns a tab pasted from a spreadsheet into a space between the terms', () => {
    assert.equal(limparBusca('nome\tsobrenome'), 'nome sobrenome');
  });

  it('covers the C1 controls, the vertical tab and the form feed', () => {
    assert.equal(limparBusca('a\u0085b\u000bc\u000cd\u009fe'), 'a b c d e');
  });

  it('leaves accents, case and emoji as they are', () => {
    assert.equal(limparBusca(' ÁÇÃO 😀 '), 'ÁÇÃO 😀');
  });

  it('returns an empty text for an empty search or one made of controls', () => {
    assert.equal(limparBusca(''), '');
    assert.equal(limparBusca('\t\u0000\u0007'), '');
  });
});

describe('erroDaBusca', () => {
  it('is empty for a normal search', () => {
    assert.equal(erroDaBusca('Ação do João'), '');
  });

  it('accepts 30 combining marks in a row', () => {
    assert.equal(erroDaBusca(marcas(30)), '');
  });

  it('refuses 31 combining marks in a row, with a message in Portuguese', () => {
    assert.equal(erroDaBusca(marcas(31)), ERRO_DE_MARCAS_NA_BUSCA);
    assert.equal(
      ERRO_DE_MARCAS_NA_BUSCA,
      'A busca não pode ter mais de 30 acentos ou marcas seguidos.',
    );
  });

  it('judges the text that is sent: a control between two runs turns into a space that splits them', () => {
    assert.equal(erroDaBusca(`${marcas(20)}\t${marcas(20)}`), '');
  });
});

describe('proximaBusca', () => {
  it('empties the search at once, without waiting, when the typed one is empty', () => {
    assert.equal(proximaBusca('', 'ana', false), '');
  });

  it('empties the search at once when the typed one is only spaces or controls', () => {
    assert.equal(proximaBusca('   ', 'ana', false), '');
    assert.equal(proximaBusca('\t\u0007', 'ana', false), '');
  });

  it('keeps the search that was valid until the wait is over', () => {
    assert.equal(proximaBusca('maria', 'ana', false), 'ana');
  });

  it('takes the typed search, cleaned, when the wait is over', () => {
    assert.equal(proximaBusca(' maria\tsilva ', 'ana', true), 'maria silva');
  });

  it('keeps the valid search when the typed one has too many marks, even after the wait', () => {
    assert.equal(proximaBusca(marcas(31), 'ana', true), 'ana');
  });

  it('empties the search when it is empty after the wait too', () => {
    assert.equal(proximaBusca('', 'ana', true), '');
  });
});
