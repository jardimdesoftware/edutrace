import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  NAO_INFORMADO,
  camposDaTabela,
  cursoDoEstudante,
  data,
  formatarDataISO,
  formularioDoRegistro,
  formularioVazioDe,
  lerCaminho,
  marcacao,
  montarCorpoDe,
  numero,
  secoesDeLeitura,
  texto,
  textoLongo,
  validarFormularioDe,
  type SecaoDef,
} from './formularioPorTabela';

const HORAS = { singular: 'hora', plural: 'horas' };

// Tabela mínima, só com a forma que os formulários reais usam: texto, texto
// longo, número, data, marcação e uma lista de verificação com um texto.
const TABELA: readonly SecaoDef[] = [
  {
    titulo: 'Dados',
    grupos: [
      {
        campos: [
          texto('nome', 'Nome', 5),
          textoLongo('detalhe.observacoes', 'Observações', 10),
          numero('detalhe.horas', 'Horas', 40, HORAS),
          data('detalhe.dia', 'Dia'),
          marcacao('ativo', 'Ativo'),
        ],
      },
    ],
  },
  {
    titulo: 'Apoios',
    grupos: [
      {
        titulo: 'Apoios',
        lista: true,
        campos: [
          marcacao('apoios.a', 'Apoio A'),
          marcacao('apoios.b', 'Apoio B'),
          texto('apoios.outro', 'Outro', 10),
        ],
      },
    ],
  },
];

const REGISTRO = {
  nome: 'Ana',
  detalhe: { observacoes: 'Texto', horas: 12, dia: '2026-10-17' },
  ativo: true,
  apoios: { a: true, b: false, outro: 'Monitor' },
};

describe('camposDaTabela', () => {
  it('lists the fields of every group of every section, in order', () => {
    assert.deepEqual(
      camposDaTabela(TABELA).map((campo) => campo.caminho),
      ['nome', 'detalhe.observacoes', 'detalhe.horas', 'detalhe.dia', 'ativo', 'apoios.a', 'apoios.b', 'apoios.outro'],
    );
  });

  it('reads the table again on every call, so a field added to it shows up', () => {
    const secoes: SecaoDef[] = [{ titulo: 'S', grupos: [{ campos: [texto('a', 'A', 1)] }] }];

    secoes[0].grupos[0].campos.push(texto('b', 'B', 1));

    assert.deepEqual(
      camposDaTabela(secoes).map((campo) => campo.caminho),
      ['a', 'b'],
    );
  });
});

describe('field builders', () => {
  it('build the definition of each kind of field', () => {
    assert.deepEqual(texto('a', 'A', 3), { tipo: 'texto', caminho: 'a', rotulo: 'A', max: 3 });
    assert.deepEqual(textoLongo('a', 'A', 3), { tipo: 'textoLongo', caminho: 'a', rotulo: 'A', max: 3 });
    assert.deepEqual(marcacao('a', 'A'), { tipo: 'marcacao', caminho: 'a', rotulo: 'A' });
    assert.deepEqual(data('a', 'A'), { tipo: 'data', caminho: 'a', rotulo: 'A' });
    assert.deepEqual(numero('a', 'A', 9, HORAS), {
      tipo: 'numero',
      caminho: 'a',
      rotulo: 'A',
      max: 9,
      unidade: HORAS,
    });
  });

  it('mark a required field only when it is asked for, so the common fields keep their shape', () => {
    assert.deepEqual(texto('a', 'A', 3, true), {
      tipo: 'texto',
      caminho: 'a',
      rotulo: 'A',
      max: 3,
      obrigatorio: true,
    });
    assert.deepEqual(textoLongo('a', 'A', 3, true), {
      tipo: 'textoLongo',
      caminho: 'a',
      rotulo: 'A',
      max: 3,
      obrigatorio: true,
    });
    assert.deepEqual(data('a', 'A', true), { tipo: 'data', caminho: 'a', rotulo: 'A', obrigatorio: true });
    assert.deepEqual(numero('a', 'A', 9, HORAS, true), {
      tipo: 'numero',
      caminho: 'a',
      rotulo: 'A',
      max: 9,
      unidade: HORAS,
      obrigatorio: true,
    });
    assert.equal('obrigatorio' in texto('a', 'A', 3), false);
    assert.equal('obrigatorio' in marcacao('a', 'A'), false);
  });
});

describe('lerCaminho', () => {
  it('reads a nested value by its dotted path', () => {
    assert.equal(lerCaminho(REGISTRO, 'detalhe.horas'), 12);
    assert.equal(lerCaminho(REGISTRO, 'ativo'), true);
  });

  it('is undefined for a path that does not exist or crosses something that is not an object', () => {
    assert.equal(lerCaminho(REGISTRO, 'nada.aqui'), undefined);
    assert.equal(lerCaminho(REGISTRO, 'nome.tamanho.x'), undefined);
    assert.equal(lerCaminho(null, 'nome'), undefined);
  });
});

describe('formularioVazioDe', () => {
  it('has every field of the table, with blank text and unchecked items', () => {
    assert.deepEqual(formularioVazioDe(TABELA), {
      nome: '',
      detalhe: { observacoes: '', horas: '', dia: '' },
      ativo: false,
      apoios: { a: false, b: false, outro: '' },
    });
  });

  it('returns a new object on every call', () => {
    const primeiro = formularioVazioDe<{ nome: string }>(TABELA);
    primeiro.nome = 'alterado';

    assert.equal(formularioVazioDe<{ nome: string }>(TABELA).nome, '');
  });
});

describe('formularioDoRegistro', () => {
  it('turns the number and the date into form text and keeps the checked items', () => {
    assert.deepEqual(formularioDoRegistro(TABELA, REGISTRO), {
      nome: 'Ana',
      detalhe: { observacoes: 'Texto', horas: '12', dia: '2026-10-17' },
      ativo: true,
      apoios: { a: true, b: false, outro: 'Monitor' },
    });
  });

  it('keeps only the day of a date that comes with time', () => {
    const registro = { ...REGISTRO, detalhe: { ...REGISTRO.detalhe, dia: '2026-10-17T00:00:00.000Z' } };

    assert.equal(lerCaminho(formularioDoRegistro(TABELA, registro), 'detalhe.dia'), '2026-10-17');
  });

  it('turns a missing or null value into blank text or an unchecked item', () => {
    const form = formularioDoRegistro(TABELA, { nome: null, detalhe: { horas: null }, ativo: 'sim' });

    assert.deepEqual(form, {
      nome: '',
      detalhe: { observacoes: '', horas: '', dia: '' },
      ativo: false,
      apoios: { a: false, b: false, outro: '' },
    });
  });

  it('keeps the number zero', () => {
    const registro = { ...REGISTRO, detalhe: { ...REGISTRO.detalhe, horas: 0 } };

    assert.equal(lerCaminho(formularioDoRegistro(TABELA, registro), 'detalhe.horas'), '0');
  });
});

describe('montarCorpoDe', () => {
  it('sends the fields of the table from the filled form', () => {
    assert.deepEqual(montarCorpoDe(TABELA, formularioDoRegistro(TABELA, REGISTRO)), REGISTRO);
  });

  it('sends only the fields of the table, leaving out whatever else the form carries', () => {
    const form = { ...(formularioVazioDe(TABELA) as object), semester: '2026.1' };

    assert.equal('semester' in (montarCorpoDe(TABELA, form) as object), false);
  });

  it('trims the texts and sends blank text as empty text and unchecked items as false', () => {
    const form = formularioVazioDe<{ nome: string }>(TABELA);
    form.nome = '  Ana  ';

    const corpo = montarCorpoDe(TABELA, form) as Record<string, unknown>;

    assert.equal(corpo.nome, 'Ana');
    assert.equal(lerCaminho(corpo, 'detalhe.observacoes'), '');
    assert.equal(corpo.ativo, false);
  });

  it('leaves the blank number and date out of the body', () => {
    const corpo = montarCorpoDe(TABELA, formularioVazioDe(TABELA)) as Record<string, object>;

    assert.equal('horas' in corpo.detalhe, false);
    assert.equal('dia' in corpo.detalhe, false);
  });

  it('sends the number as a number, including zero', () => {
    const form = formularioVazioDe(TABELA);
    (form as { detalhe: { horas: string } }).detalhe.horas = ' 0 ';

    assert.equal(lerCaminho(montarCorpoDe(TABELA, form), 'detalhe.horas'), 0);
  });

  it('does not change the form', () => {
    const form = formularioVazioDe<{ nome: string }>(TABELA);
    form.nome = '  Ana  ';

    montarCorpoDe(TABELA, form);

    assert.equal(form.nome, '  Ana  ');
  });
});

describe('validarFormularioDe', () => {
  function formComCampo(caminho: string, valor: string) {
    const partes = caminho.split('.');
    const form = formularioVazioDe<Record<string, Record<string, string> | string>>(TABELA);
    if (partes.length === 1) form[partes[0]] = valor;
    else (form[partes[0]] as Record<string, string>)[partes[1]] = valor;
    return form;
  }

  it('accepts the empty form and the filled form', () => {
    assert.deepEqual(validarFormularioDe(TABELA, formularioVazioDe(TABELA)), {});
    assert.deepEqual(validarFormularioDe(TABELA, formularioDoRegistro(TABELA, REGISTRO)), {});
  });

  it('refuses a text above its limit, naming the field and the limit, and accepts it at the limit', () => {
    assert.deepEqual(validarFormularioDe(TABELA, formComCampo('nome', 'a'.repeat(6))), {
      nome: 'O campo "Nome" deve ter no máximo 5 caracteres.',
    });
    assert.deepEqual(validarFormularioDe(TABELA, formComCampo('nome', 'a'.repeat(5))), {});
    assert.deepEqual(validarFormularioDe(TABELA, formComCampo('nome', `  ${'a'.repeat(5)}  `)), {});
  });

  it('refuses a long text above its limit, keyed by the path of the field', () => {
    const erros = validarFormularioDe(TABELA, formComCampo('detalhe.observacoes', 'a'.repeat(11)));

    assert.deepEqual(Object.keys(erros), ['detalhe.observacoes']);
    assert.match(erros['detalhe.observacoes'], /10 caracteres/);
  });

  it('accepts whole numbers from 0 to the limit and refuses anything else', () => {
    for (const valor of ['0', '1', '40', ' 17 ']) {
      assert.deepEqual(validarFormularioDe(TABELA, formComCampo('detalhe.horas', valor)), {}, valor);
    }
    for (const valor of ['41', '-1', '1.5', '1,5', 'abc', '1e2', '10 horas']) {
      assert.equal(
        validarFormularioDe(TABELA, formComCampo('detalhe.horas', valor))['detalhe.horas'],
        'O campo "Horas" deve ser um número inteiro entre 0 e 40.',
        valor,
      );
    }
  });

  it('refuses a date that does not exist and accepts a leap day', () => {
    for (const valor of ['2026-02-30', '2026-13-01', '17/10/2026', '2026-1-1', 'ontem']) {
      assert.equal(
        validarFormularioDe(TABELA, formComCampo('detalhe.dia', valor))['detalhe.dia'],
        'O campo "Dia" deve ser uma data válida.',
        valor,
      );
    }
    assert.deepEqual(validarFormularioDe(TABELA, formComCampo('detalhe.dia', '2028-02-29')), {});
  });
});

describe('validarFormularioDe com campos obrigatórios', () => {
  const OBRIGATORIOS: readonly SecaoDef[] = [
    {
      titulo: 'Dados',
      grupos: [
        {
          campos: [
            texto('nome', 'Nome', 5, true),
            textoLongo('detalhe.observacoes', 'Observações', 10, true),
            numero('detalhe.horas', 'Horas', 40, HORAS, true),
            data('detalhe.dia', 'Dia', true),
            marcacao('ativo', 'Ativo'),
            texto('apelido', 'Apelido', 5),
          ],
        },
      ],
    },
  ];
  const PREENCHIDO = {
    nome: 'Ana',
    detalhe: { observacoes: 'Texto', horas: '12', dia: '2026-10-17' },
    ativo: false,
    apelido: '',
  };

  it('refuses the blank required fields, naming each one by its path', () => {
    assert.deepEqual(validarFormularioDe(OBRIGATORIOS, formularioVazioDe(OBRIGATORIOS)), {
      nome: 'O campo "Nome" é obrigatório.',
      'detalhe.observacoes': 'O campo "Observações" é obrigatório.',
      'detalhe.horas': 'O campo "Horas" é obrigatório.',
      'detalhe.dia': 'O campo "Dia" é obrigatório.',
    });
  });

  it('treats spaces as blank', () => {
    const erros = validarFormularioDe(OBRIGATORIOS, { ...PREENCHIDO, nome: '   ' });

    assert.deepEqual(erros, { nome: 'O campo "Nome" é obrigatório.' });
  });

  it('accepts the filled form, with the number zero and an unchecked box', () => {
    assert.deepEqual(validarFormularioDe(OBRIGATORIOS, PREENCHIDO), {});
    assert.deepEqual(
      validarFormularioDe(OBRIGATORIOS, { ...PREENCHIDO, detalhe: { ...PREENCHIDO.detalhe, horas: '0' } }),
      {},
    );
  });

  it('says the field is required before it checks the limit', () => {
    assert.equal(
      validarFormularioDe(OBRIGATORIOS, { ...PREENCHIDO, nome: '' }).nome,
      'O campo "Nome" é obrigatório.',
    );
    assert.equal(
      validarFormularioDe(OBRIGATORIOS, { ...PREENCHIDO, nome: 'a'.repeat(6) }).nome,
      'O campo "Nome" deve ter no máximo 5 caracteres.',
    );
  });

  it('never refuses an optional field left blank', () => {
    assert.equal('apelido' in validarFormularioDe(OBRIGATORIOS, PREENCHIDO), false);
  });
});

describe('formatarDataISO', () => {
  it('prints the day without moving it by the time zone', () => {
    assert.equal(formatarDataISO('2026-10-17'), '17/10/2026');
    assert.equal(formatarDataISO('2026-10-17T00:00:00.000Z'), '17/10/2026');
  });

  it('prints nothing for a missing or invalid date', () => {
    for (const valor of [null, undefined, '', 'amanhã']) {
      assert.equal(formatarDataISO(valor), '');
    }
  });
});

describe('secoesDeLeitura', () => {
  function valorDe(secoes: ReturnType<typeof secoesDeLeitura>, titulo: string, rotulo: string) {
    const linha = secoes.find((s) => s.titulo === titulo)?.linhas.find((l) => l.label === rotulo);
    assert.ok(linha, `linha ${rotulo} não encontrada`);
    return linha.value;
  }

  it('lists the sections of the table, in order, with the label of each field', () => {
    const secoes = secoesDeLeitura(TABELA, REGISTRO);

    assert.deepEqual(
      secoes.map((secao) => secao.titulo),
      ['Dados', 'Apoios'],
    );
    assert.deepEqual(
      secoes[0].linhas.map((linha) => linha.label),
      ['Nome', 'Observações', 'Horas', 'Dia', 'Ativo'],
    );
  });

  it('prints the text, the number with its unit, the date and the checkbox', () => {
    const secoes = secoesDeLeitura(TABELA, REGISTRO);

    assert.equal(valorDe(secoes, 'Dados', 'Nome'), 'Ana');
    assert.equal(valorDe(secoes, 'Dados', 'Horas'), '12 horas');
    assert.equal(valorDe(secoes, 'Dados', 'Dia'), '17/10/2026');
    assert.equal(valorDe(secoes, 'Dados', 'Ativo'), 'Sim');
  });

  it('prints the singular for one unit and Não for an unchecked box', () => {
    const registro = { ...REGISTRO, ativo: false, detalhe: { ...REGISTRO.detalhe, horas: 1 } };
    const secoes = secoesDeLeitura(TABELA, registro);

    assert.equal(valorDe(secoes, 'Dados', 'Horas'), '1 hora');
    assert.equal(valorDe(secoes, 'Dados', 'Ativo'), 'Não');
  });

  it('prints "Não informado" for blank text, a missing number and a missing date', () => {
    const secoes = secoesDeLeitura(TABELA, { nome: '   ', detalhe: { horas: null } });

    assert.equal(valorDe(secoes, 'Dados', 'Nome'), NAO_INFORMADO);
    assert.equal(valorDe(secoes, 'Dados', 'Observações'), NAO_INFORMADO);
    assert.equal(valorDe(secoes, 'Dados', 'Horas'), NAO_INFORMADO);
    assert.equal(valorDe(secoes, 'Dados', 'Dia'), NAO_INFORMADO);
  });

  it('lists only the checked items of a checklist, one per line, with the text in its own row', () => {
    const secoes = secoesDeLeitura(TABELA, REGISTRO);

    assert.deepEqual(secoes[1].linhas, [
      { label: 'Apoios', value: '• Apoio A' },
      { label: 'Apoios: outro', value: 'Monitor' },
    ]);
  });

  it('prints "Nenhuma opção marcada" for a checklist without items', () => {
    const secoes = secoesDeLeitura(TABELA, {});

    assert.deepEqual(secoes[1].linhas, [
      { label: 'Apoios', value: 'Nenhuma opção marcada' },
      { label: 'Apoios: outro', value: NAO_INFORMADO },
    ]);
  });
});

describe('cursoDoEstudante', () => {
  it('uses the course of the loaded record, which is all a student reading their own record has', () => {
    assert.equal(cursoDoEstudante({ student: { course: 'Informática' } }, null), 'Informática');
  });

  it('prefers the course of the loaded record over the one of the registration', () => {
    assert.equal(
      cursoDoEstudante({ student: { course: 'Informática' } }, { course: 'Edificações' }),
      'Informática',
    );
  });

  it('keeps null when the loaded record says the student has no course', () => {
    assert.equal(cursoDoEstudante({ student: { course: null } }, { course: 'Edificações' }), null);
  });

  it('uses the course of the registration when there is no record yet', () => {
    assert.equal(cursoDoEstudante(null, { course: 'Edificações' }), 'Edificações');
    assert.equal(cursoDoEstudante(null, { course: null }), null);
    assert.equal(cursoDoEstudante(null, {}), null);
  });

  it('falls back to the registration when the API sends the record without the student', () => {
    assert.equal(cursoDoEstudante({}, { course: 'Edificações' }), 'Edificações');
  });

  it('is unknown without a record and without a registration', () => {
    assert.equal(cursoDoEstudante(null, null), undefined);
  });
});
