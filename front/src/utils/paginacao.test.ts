import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { TAMANHO_DA_PAGINA, paginar, textoDoIntervalo } from "./paginacao";

const numeros = (quantidade: number) =>
  Array.from({ length: quantidade }, (_, indice) => indice + 1);

describe("paginar", () => {
  it("keeps a short list on a single page, with no way to go back or forward", () => {
    const p = paginar(numeros(5), 1);

    assert.deepEqual(p.itens, [1, 2, 3, 4, 5]);
    assert.equal(p.totalDePaginas, 1);
    assert.equal(p.temAnterior, false);
    assert.equal(p.temProxima, false);
    assert.equal(p.primeiro, 1);
    assert.equal(p.ultimo, 5);
    assert.equal(p.total, 5);
  });

  it("uses 10 items per page by default", () => {
    assert.equal(TAMANHO_DA_PAGINA, 10);
    assert.equal(paginar(numeros(25), 1).itens.length, 10);
  });

  it("cuts the middle page and can go both ways", () => {
    const p = paginar(numeros(25), 2);

    assert.deepEqual(p.itens, numeros(25).slice(10, 20));
    assert.equal(p.totalDePaginas, 3);
    assert.equal(p.temAnterior, true);
    assert.equal(p.temProxima, true);
    assert.equal(p.primeiro, 11);
    assert.equal(p.ultimo, 20);
  });

  it("cuts a last page shorter than the others and cannot go forward", () => {
    const p = paginar(numeros(25), 3);

    assert.deepEqual(p.itens, [21, 22, 23, 24, 25]);
    assert.equal(p.temProxima, false);
    assert.equal(p.temAnterior, true);
    assert.equal(p.ultimo, 25);
  });

  it("closes a full last page without inventing an empty one", () => {
    const p = paginar(numeros(20), 1);

    assert.equal(p.totalDePaginas, 2);
  });

  it("pulls a page that no longer exists back to the last one", () => {
    const p = paginar(numeros(12), 9);

    assert.equal(p.pagina, 2);
    assert.deepEqual(p.itens, [11, 12]);
  });

  it("pulls an invalid page back to the first", () => {
    for (const pagina of [0, -3, Number.NaN]) {
      assert.equal(paginar(numeros(25), pagina).pagina, 1, String(pagina));
    }
  });

  it("answers a single empty page for an empty list", () => {
    const p = paginar([], 1);

    assert.deepEqual(p.itens, []);
    assert.equal(p.totalDePaginas, 1);
    assert.equal(p.primeiro, 0);
    assert.equal(p.ultimo, 0);
    assert.equal(p.temAnterior, false);
    assert.equal(p.temProxima, false);
  });

  it("accepts another page size", () => {
    assert.equal(paginar(numeros(7), 1, 3).totalDePaginas, 3);
  });

  it("does not change the list it receives", () => {
    const lista = numeros(15);

    paginar(lista, 2);

    assert.deepEqual(lista, numeros(15));
  });
});

describe("textoDoIntervalo", () => {
  it("writes how many are on screen out of the total", () => {
    assert.equal(
      textoDoIntervalo(paginar(numeros(23), 1), "usuário", "usuários"),
      "Exibindo 10 de 23 usuários",
    );
    assert.equal(
      textoDoIntervalo(paginar(numeros(23), 3), "usuário", "usuários"),
      "Exibindo 3 de 23 usuários",
    );
  });

  it("shows the real total, not a fixed one", () => {
    assert.equal(
      textoDoIntervalo(paginar(numeros(5), 1), "usuário", "usuários"),
      "Exibindo 5 de 5 usuários",
    );
  });

  it("uses the singular for a total of one", () => {
    assert.equal(
      textoDoIntervalo(paginar(numeros(1), 1), "estudante", "estudantes"),
      "Exibindo 1 de 1 estudante",
    );
  });

  it("writes an empty list as zero of zero", () => {
    assert.equal(
      textoDoIntervalo(paginar([], 1), "usuário", "usuários"),
      "Exibindo 0 de 0 usuários",
    );
  });
});
