import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { marcacao, texto, textoLongo, type SecaoDef } from './formularioPorTabela';
import {
  PESO_MAXIMO_DO_PASSO,
  houveAlteracao,
  limitarPasso,
  passoDoCaminho,
  passosDe,
  pesoDoPasso,
  primeiroCaminhoComErro,
  situacaoDosPassos,
  textoDoBloqueio,
} from './passosDoFormulario';

const SECOES: readonly SecaoDef[] = [
  { titulo: 'Identificação', grupos: [{ campos: [texto('nome', 'Nome', 10)] }] },
  {
    titulo: 'Família',
    passo: 'Casa',
    grupos: [{ campos: [texto('familia.mae', 'Mãe', 10)] }],
  },
  {
    titulo: 'Moradia',
    passo: 'Casa',
    grupos: [{ campos: [texto('moradia.rua', 'Rua', 10)] }],
    caminhosExtras: ['moradia.itens'],
  },
  {
    titulo: 'Aspectos',
    dividirPorGrupo: true,
    grupos: [
      { titulo: 'Fala', lista: true, campos: [marcacao('aspectos.fala.a', 'A')] },
      { titulo: 'Escrita', lista: true, campos: [marcacao('aspectos.escrita.a', 'A')] },
    ],
  },
  { titulo: 'Parecer', grupos: [{ campos: [textoLongo('parecer', 'Parecer', 100)] }] },
];

describe('passosDe', () => {
  it('makes one step per section when no section names a step', () => {
    const passos = passosDe([SECOES[0], SECOES[4]]);

    assert.deepEqual(
      passos.map((passo) => passo.rotulo),
      ['Identificação', 'Parecer'],
    );
  });

  it('joins the sections that follow each other with the same step name', () => {
    const passos = passosDe(SECOES);
    const casa = passos[1];

    assert.equal(casa.rotulo, 'Casa');
    assert.deepEqual(
      casa.secoes.map((secao) => secao.titulo),
      ['Família', 'Moradia'],
    );
  });

  it('splits a section marked to be divided into one step per group, named after the group', () => {
    const passos = passosDe(SECOES);

    assert.deepEqual(
      passos.map((passo) => passo.rotulo),
      ['Identificação', 'Casa', 'Fala', 'Escrita', 'Parecer'],
    );
    assert.deepEqual(
      passos[2].secoes[0].grupos.map((grupo) => grupo.titulo),
      ['Fala'],
    );
  });

  it('does not join sections with the same step name when something else comes between them', () => {
    const passos = passosDe([
      { titulo: 'A', passo: 'X', grupos: [] },
      { titulo: 'B', grupos: [] },
      { titulo: 'C', passo: 'X', grupos: [] },
    ]);

    assert.deepEqual(
      passos.map((passo) => passo.rotulo),
      ['X', 'B', 'X'],
    );
  });

  it('does not change the table it receives', () => {
    const copia = JSON.parse(JSON.stringify(SECOES));

    passosDe(SECOES);

    assert.deepEqual(JSON.parse(JSON.stringify(SECOES)), copia);
  });

  it('is empty for an empty table', () => {
    assert.deepEqual(passosDe([]), []);
  });
});

describe('passoDoCaminho', () => {
  const passos = passosDe(SECOES);

  it('finds the step of a field, including a field of a joined section', () => {
    assert.equal(passoDoCaminho(passos, 'nome'), 0);
    assert.equal(passoDoCaminho(passos, 'familia.mae'), 1);
    assert.equal(passoDoCaminho(passos, 'moradia.rua'), 1);
    assert.equal(passoDoCaminho(passos, 'aspectos.escrita.a'), 3);
  });

  it('finds the step of a path the table does not list but the section declares as extra', () => {
    assert.equal(passoDoCaminho(passos, 'moradia.itens'), 1);
  });

  it('puts an item of a list in the step of the list', () => {
    assert.equal(passoDoCaminho(passos, 'moradia.itens.3.nome'), 1);
  });

  it('does not take a path that only shares the prefix without the dot', () => {
    assert.equal(passoDoCaminho(passos, 'nomeado'), -1);
    assert.equal(passoDoCaminho(passos, 'moradia.itensx'), -1);
  });

  it('is -1 for a path no step has', () => {
    assert.equal(passoDoCaminho(passos, 'outro'), -1);
  });
});

describe('situacaoDosPassos', () => {
  const passos = passosDe(SECOES);

  it('lets the form be concluded when there is no error', () => {
    const situacao = situacaoDosPassos(passos, {});

    assert.equal(situacao.podeConcluir, true);
    assert.equal(situacao.pendencias, 0);
    assert.equal(situacao.primeiroComPendencia, null);
    assert.deepEqual(situacao.comPendencia, [false, false, false, false, false]);
  });

  it('marks each step that has an error and points to the first of them', () => {
    const situacao = situacaoDosPassos(passos, { parecer: 'x', 'moradia.rua': 'y', 'moradia.itens.0.a': 'z' });

    assert.equal(situacao.podeConcluir, false);
    assert.equal(situacao.pendencias, 3);
    assert.deepEqual(situacao.comPendencia, [false, true, false, false, true]);
    assert.equal(situacao.primeiroComPendencia, 1);
  });

  it('sends an error of a path no step knows to the first step, so the block is never invisible', () => {
    const situacao = situacaoDosPassos(passos, { desconhecido: 'x' });

    assert.equal(situacao.podeConcluir, false);
    assert.deepEqual(situacao.comPendencia, [true, false, false, false, false]);
    assert.equal(situacao.primeiroComPendencia, 0);
  });
});

describe('primeiroCaminhoComErro', () => {
  const passos = passosDe(SECOES);

  it('is null without errors', () => {
    assert.equal(primeiroCaminhoComErro(passos, {}), null);
  });

  it('picks the error of the first step that has one, whatever the order of the keys', () => {
    assert.equal(
      primeiroCaminhoComErro(passos, { parecer: 'x', 'familia.mae': 'y', nome: 'z' }),
      'nome',
    );
    assert.equal(primeiroCaminhoComErro(passos, { parecer: 'x', 'moradia.rua': 'y' }), 'moradia.rua');
  });

  it('keeps the first key when two errors are in the same step', () => {
    assert.equal(
      primeiroCaminhoComErro(passos, { 'moradia.rua': 'a', 'familia.mae': 'b' }),
      'moradia.rua',
    );
  });
});

describe('textoDoBloqueio', () => {
  const passos = passosDe(SECOES);

  it('is empty when the form can be concluded', () => {
    assert.equal(textoDoBloqueio(passos, {}), '');
  });

  it('counts the fields and names the steps, in the order of the steps', () => {
    assert.equal(
      textoDoBloqueio(passos, { parecer: 'x', nome: 'y', 'moradia.rua': 'z' }),
      'Para concluir, resolva 3 pendências em: Identificação, Casa, Parecer.',
    );
  });

  it('uses the singular for one field', () => {
    assert.equal(
      textoDoBloqueio(passos, { nome: 'x' }),
      'Para concluir, resolva 1 pendência em: Identificação.',
    );
  });
});

describe('limitarPasso', () => {
  it('keeps the step inside the first and the last one', () => {
    assert.equal(limitarPasso(-1, 5), 0);
    assert.equal(limitarPasso(2, 5), 2);
    assert.equal(limitarPasso(9, 5), 4);
  });

  it('is 0 when there are no steps', () => {
    assert.equal(limitarPasso(3, 0), 0);
  });
});

describe('houveAlteracao', () => {
  it('is false for the same values and true when a value changes', () => {
    assert.equal(houveAlteracao({ a: '1', b: { c: true } }, { a: '1', b: { c: true } }), false);
    assert.equal(houveAlteracao({ a: '1', b: { c: true } }, { a: '1', b: { c: false } }), true);
  });
});

describe('pesoDoPasso', () => {
  it('weighs a long text more than a short field or a checkbox', () => {
    const passos = passosDe(SECOES);

    assert.equal(pesoDoPasso(passos[0]), 1);
    assert.equal(pesoDoPasso(passos[1]), 2);
    assert.equal(pesoDoPasso(passos[4]), 5);
  });

  it('keeps the limit of a step that fits on the screen at 25', () => {
    assert.equal(PESO_MAXIMO_DO_PASSO, 25);
  });
});
