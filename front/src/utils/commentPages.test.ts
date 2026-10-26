import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  cargaComErro,
  cargaComErroDeMais,
  cargaComMais,
  cargaConcluida,
  criarSequencia,
  estadoDaLista,
  juntarPaginas,
  resumoDaContagem,
  type Carga,
} from './commentPages';
import type { CommentData, CommentPage } from '../interfaces/CommentData';

function anotacao(id: number, comment = `Anotação ${id}`): CommentData {
  return {
    id,
    type: 'NOTE',
    id_user: 100,
    id_author: 1,
    author_name: 'Autora',
    author_roles: [3],
    comment,
    created_at: new Date('2026-10-01T12:00:00Z'),
  };
}

function pagina(ids: number[], resto: Partial<CommentPage> = {}): CommentPage {
  return {
    items: ids.map((id) => anotacao(id)),
    next_cursor: null,
    total: ids.length,
    overall: ids.length,
    authors: [],
    ...resto,
  };
}

describe('juntarPaginas', () => {
  it('appends the new items after the loaded ones, keeping the order of the API', () => {
    const atual = pagina([9, 8, 7], { next_cursor: 7, total: 6, overall: 6 });
    const nova = pagina([6, 5, 4], { next_cursor: null, total: 6, overall: 6 });

    const juntas = juntarPaginas(atual, nova);

    assert.deepEqual(
      juntas.items.map((item) => item.id),
      [9, 8, 7, 6, 5, 4],
    );
  });

  it('does not repeat an item whose id is already loaded', () => {
    const atual = pagina([9, 8, 7], { next_cursor: 7 });
    const nova = pagina([8, 7, 6]);

    const juntas = juntarPaginas(atual, nova);

    assert.deepEqual(
      juntas.items.map((item) => item.id),
      [9, 8, 7, 6],
    );
  });

  it('keeps the loaded copy of the repeated item', () => {
    const atual = pagina([2, 1]);
    const nova = { ...pagina([1]), items: [anotacao(1, 'texto da página nova')] };

    const juntas = juntarPaginas(atual, nova);

    assert.equal(juntas.items.find((item) => item.id === 1)?.comment, 'Anotação 1');
  });

  it('takes the cursor, the totals and the authors from the new page', () => {
    const atual = pagina([9, 8], {
      next_cursor: 8,
      total: 5,
      overall: 7,
      authors: [{ id: 1, name: 'Ana' }],
    });
    const nova = pagina([7, 6], {
      next_cursor: 6,
      total: 5,
      overall: 8,
      authors: [
        { id: 1, name: 'Ana' },
        { id: 2, name: 'Bruno' },
      ],
    });

    const juntas = juntarPaginas(atual, nova);

    assert.equal(juntas.next_cursor, 6);
    assert.equal(juntas.total, 5);
    assert.equal(juntas.overall, 8);
    assert.deepEqual(juntas.authors, nova.authors);
  });

  it('ends the list when the new page has no next cursor', () => {
    const juntas = juntarPaginas(pagina([3], { next_cursor: 3 }), pagina([2, 1]));

    assert.equal(juntas.next_cursor, null);
  });

  it('leaves both pages untouched and returns a new object', () => {
    const atual = pagina([3, 2]);
    atual.items.forEach(Object.freeze);
    Object.freeze(atual.items);
    Object.freeze(atual);
    const nova = pagina([1]);
    Object.freeze(nova.items);
    Object.freeze(nova);

    const juntas = juntarPaginas(atual, nova);

    assert.notEqual(juntas, atual);
    assert.notEqual(juntas.items, atual.items);
    assert.equal(atual.items.length, 2);
    assert.equal(nova.items.length, 1);
  });
});

describe('criarSequencia', () => {
  it('marks the latest request as current', () => {
    const iniciar = criarSequencia();

    const primeira = iniciar();

    assert.equal(primeira(), true);
  });

  it('makes an older request stale as soon as a newer one starts', () => {
    const iniciar = criarSequencia();

    const antiga = iniciar();
    const nova = iniciar();

    assert.equal(antiga(), false);
    assert.equal(nova(), true);
  });

  it('keeps only the last of several requests current', () => {
    const iniciar = criarSequencia();

    const requisicoes = [iniciar(), iniciar(), iniciar()];

    assert.deepEqual(
      requisicoes.map((atual) => atual()),
      [false, false, true],
    );
  });

  it('does not let one sequence affect another', () => {
    const iniciarA = criarSequencia();
    const iniciarB = criarSequencia();

    const deA = iniciarA();
    iniciarB();

    assert.equal(deA(), true);
  });

  it('discards the late answer of an old filter when the new answer came first', async () => {
    const iniciar = criarSequencia();
    const mostradas: string[] = [];
    const responder = async (filtro: string, demoraMs: number) => {
      const atual = iniciar();
      await new Promise((resolver) => setTimeout(resolver, demoraMs));
      if (atual()) mostradas.push(filtro);
    };

    await Promise.all([responder('filtro antigo', 30), responder('filtro novo', 5)]);

    assert.deepEqual(mostradas, ['filtro novo']);
  });
});

describe('resumoDaContagem', () => {
  it('shows how many loaded out of the total, with no filter', () => {
    assert.equal(
      resumoDaContagem({ carregadas: 20, total: 57, overall: 57 }),
      'Mostrando 20 de 57 anotações.',
    );
  });

  it('shows the filtered total and the overall one when the filters cut the list', () => {
    assert.equal(
      resumoDaContagem({ carregadas: 20, total: 42, overall: 57 }),
      'Mostrando 20 de 42 anotações filtradas (57 no total).',
    );
  });

  it('uses the singular for one note', () => {
    assert.equal(
      resumoDaContagem({ carregadas: 1, total: 1, overall: 1 }),
      'Mostrando 1 de 1 anotação.',
    );
    assert.equal(
      resumoDaContagem({ carregadas: 1, total: 1, overall: 9 }),
      'Mostrando 1 de 1 anotação filtrada (9 no total).',
    );
  });

  it('says that no note matches the filters', () => {
    assert.equal(
      resumoDaContagem({ carregadas: 0, total: 0, overall: 57 }),
      'Mostrando 0 de 0 anotações filtradas (57 no total).',
    );
  });
});

function carga(resto: Partial<Carga> = {}): Carga {
  return {
    chave: 'chave-a',
    idEstudante: 100,
    pagina: pagina([3, 2, 1], { next_cursor: 1, total: 5, overall: 5 }),
    erro: null,
    erroMais: null,
    ...resto,
  };
}

describe('cargaConcluida', () => {
  it('builds a load with the page and without errors', () => {
    const recebida = pagina([2, 1]);

    assert.deepEqual(cargaConcluida('chave-a', 100, recebida), {
      chave: 'chave-a',
      idEstudante: 100,
      pagina: recebida,
      erro: null,
      erroMais: null,
    });
  });
});

describe('cargaComErro', () => {
  it('keeps the page already shown when the failed load is for the same student', () => {
    const anterior = carga({ chave: 'chave-antiga', idEstudante: 100 });

    const falha = cargaComErro(anterior, 'chave-nova', 100, 'Falhou');

    assert.equal(falha.pagina, anterior.pagina);
    assert.equal(falha.erro, 'Falhou');
    assert.equal(falha.chave, 'chave-nova');
    assert.equal(falha.idEstudante, 100);
  });

  it('drops the page of ANOTHER student, which must never show under the new one', () => {
    const doOutro = carga({ idEstudante: 999 });

    const falha = cargaComErro(doOutro, 'chave-nova', 100, 'Falhou');

    assert.equal(falha.pagina, null);
    assert.equal(falha.idEstudante, 100);
  });

  it('has no page when there was no load before', () => {
    assert.equal(cargaComErro(null, 'chave-nova', 100, 'Falhou').pagina, null);
  });

  it('clears the error of the load-more of the previous load', () => {
    const anterior = carga({ erroMais: 'falha antiga' });

    assert.equal(cargaComErro(anterior, 'chave-nova', 100, 'Falhou').erroMais, null);
  });

  it('does not change the previous load', () => {
    const anterior = Object.freeze(carga({ idEstudante: 100 }));

    assert.doesNotThrow(() => cargaComErro(anterior, 'chave-nova', 100, 'Falhou'));
    assert.equal(anterior.erro, null);
  });
});

describe('cargaComMais', () => {
  it('joins the new page into the load of the same key', () => {
    const atual = carga({ chave: 'chave-a' });

    const juntada = cargaComMais(atual, 'chave-a', pagina([0], { next_cursor: null }));

    assert.deepEqual(
      juntada?.pagina?.items.map((item) => item.id),
      [3, 2, 1, 0],
    );
    assert.equal(juntada?.pagina?.next_cursor, null);
  });

  it('does NOT join into the load of another key: the filters changed while it loaded', () => {
    const atual = carga({ chave: 'chave-b' });

    const resultado = cargaComMais(atual, 'chave-a', pagina([0]));

    assert.equal(resultado, atual);
    assert.deepEqual(
      resultado?.pagina?.items.map((item) => item.id),
      [3, 2, 1],
    );
  });

  it('does nothing when there is no load yet', () => {
    assert.equal(cargaComMais(null, 'chave-a', pagina([0])), null);
  });

  it('does nothing when the load of the key has no page', () => {
    const semPagina = carga({ chave: 'chave-a', pagina: null, erro: 'Falhou' });

    assert.equal(cargaComMais(semPagina, 'chave-a', pagina([0])), semPagina);
  });

  it('clears the load-more error once more items arrive', () => {
    const atual = carga({ chave: 'chave-a', erroMais: 'falha antiga' });

    assert.equal(cargaComMais(atual, 'chave-a', pagina([0]))?.erroMais, null);
  });

  it('does not change the load it receives', () => {
    const atual = carga({ chave: 'chave-a' });

    cargaComMais(atual, 'chave-a', pagina([0]));

    assert.equal(atual.pagina?.items.length, 3);
  });
});

describe('cargaComErroDeMais', () => {
  it('records the error in the load of the same key, keeping the page', () => {
    const atual = carga({ chave: 'chave-a' });

    const resultado = cargaComErroDeMais(atual, 'chave-a', 'Falhou');

    assert.equal(resultado?.erroMais, 'Falhou');
    assert.equal(resultado?.pagina, atual.pagina);
  });

  it('does NOT record the error in the load of another key', () => {
    const atual = carga({ chave: 'chave-b' });

    assert.equal(cargaComErroDeMais(atual, 'chave-a', 'Falhou'), atual);
    assert.equal(atual.erroMais, null);
  });

  it('does nothing when there is no load', () => {
    assert.equal(cargaComErroDeMais(null, 'chave-a', 'Falhou'), null);
  });
});

describe('estadoDaLista', () => {
  it('is loading, with no page, before the first load arrives', () => {
    assert.deepEqual(estadoDaLista(null, 100, 'chave-a'), {
      pagina: null,
      carregando: true,
      erro: null,
      erroMais: null,
      proximo: null,
      temMais: false,
    });
  });

  it('is not loading, and has nothing, when there is no student', () => {
    const estado = estadoDaLista(null, null, 'chave-a');

    assert.equal(estado.carregando, false);
    assert.equal(estado.pagina, null);
  });

  it('shows the loaded page, with the next cursor, when the load is of the same key', () => {
    const atual = carga({ chave: 'chave-a' });

    const estado = estadoDaLista(atual, 100, 'chave-a');

    assert.equal(estado.pagina, atual.pagina);
    assert.equal(estado.carregando, false);
    assert.equal(estado.erro, null);
    assert.equal(estado.proximo, 1);
    assert.equal(estado.temMais, true);
  });

  it('has neither next cursor nor "has more" when the page is the last one', () => {
    const ultima = carga({ pagina: pagina([2, 1], { next_cursor: null }) });

    const estado = estadoDaLista(ultima, 100, 'chave-a');

    assert.equal(estado.proximo, null);
    assert.equal(estado.temMais, false);
  });

  it('keeps the old page, dimmed, while the load of a new key runs, but cannot load more of it', () => {
    const antiga = carga({ chave: 'chave-antiga' });

    const estado = estadoDaLista(antiga, 100, 'chave-nova');

    assert.equal(estado.pagina, antiga.pagina);
    assert.equal(estado.carregando, true);
    assert.equal(estado.proximo, null);
    assert.equal(estado.temMais, true);
  });

  it('shows NOTHING of the page of another student: it is loading, with no page', () => {
    const doOutro = carga({ idEstudante: 999, chave: 'chave-a' });

    const estado = estadoDaLista(doOutro, 100, 'chave-a');

    assert.equal(estado.pagina, null);
    assert.equal(estado.carregando, true);
    assert.equal(estado.proximo, null);
    assert.equal(estado.temMais, false);
    assert.equal(estado.erro, null);
  });

  it('ignores the error of a load of another student', () => {
    const doOutro = carga({ idEstudante: 999, chave: 'chave-a', erro: 'Falhou' });

    assert.equal(estadoDaLista(doOutro, 100, 'chave-a').erro, null);
  });

  it('reports the error of the load of the same key and blocks "load more"', () => {
    const comErro = carga({ chave: 'chave-a', erro: 'Falhou' });

    const estado = estadoDaLista(comErro, 100, 'chave-a');

    assert.equal(estado.erro, 'Falhou');
    assert.equal(estado.carregando, false);
    assert.equal(estado.proximo, null);
    assert.equal(estado.temMais, false);
  });

  it('ignores the error of a load of an old key: the new one is still loading', () => {
    const comErroAntigo = carga({ chave: 'chave-antiga', erro: 'Falhou' });

    const estado = estadoDaLista(comErroAntigo, 100, 'chave-nova');

    assert.equal(estado.erro, null);
    assert.equal(estado.carregando, true);
  });

  it('reports the load-more error only for the load of the same key', () => {
    const comErroMais = carga({ chave: 'chave-a', erroMais: 'Falhou ao carregar mais' });

    assert.equal(estadoDaLista(comErroMais, 100, 'chave-a').erroMais, 'Falhou ao carregar mais');
    assert.equal(estadoDaLista(comErroMais, 100, 'chave-b').erroMais, null);
  });

  it('keeps the page on error, so the filter panel does not disappear', () => {
    const falha = cargaComErro(carga({ idEstudante: 100 }), 'chave-nova', 100, 'Falhou');

    const estado = estadoDaLista(falha, 100, 'chave-nova');

    assert.notEqual(estado.pagina, null);
    assert.equal(estado.erro, 'Falhou');
  });

  it('has no page on error when the page was of another student', () => {
    const falha = cargaComErro(carga({ idEstudante: 999 }), 'chave-nova', 100, 'Falhou');

    assert.equal(estadoDaLista(falha, 100, 'chave-nova').pagina, null);
  });
});
