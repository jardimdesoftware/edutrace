import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { MARGEM_DO_PAINEL, posicaoDoPainel } from "./posicaoDoPainel";

const JANELA = { width: 1000, height: 800 };
const PAINEL = { width: 256, height: 220 };

describe("posicaoDoPainel", () => {
  it("opens below the trigger, aligned to its left edge, when there is room", () => {
    const posicao = posicaoDoPainel(
      { top: 100, bottom: 130, left: 400 },
      PAINEL,
      JANELA,
    );

    assert.deepEqual(posicao, { top: 130, left: 400 });
  });

  it("opens above the trigger when it does not fit below but fits above", () => {
    const posicao = posicaoDoPainel(
      { top: 700, bottom: 730, left: 400 },
      PAINEL,
      JANELA,
    );

    assert.deepEqual(posicao, { top: 700 - PAINEL.height, left: 400 });
  });

  it("stays below when it fits neither below nor above, so the top of the panel is never lost", () => {
    const posicao = posicaoDoPainel(
      { top: 100, bottom: 130, left: 400 },
      { width: 256, height: 900 },
      JANELA,
    );

    assert.equal(posicao.top, 130);
  });

  it("opens below when it fits exactly in the space left", () => {
    const bottom = JANELA.height - PAINEL.height - MARGEM_DO_PAINEL;
    const posicao = posicaoDoPainel(
      { top: bottom - 30, bottom, left: 400 },
      PAINEL,
      JANELA,
    );

    assert.equal(posicao.top, bottom);
  });

  it("never passes the right edge of the window", () => {
    const posicao = posicaoDoPainel(
      { top: 100, bottom: 130, left: 900 },
      PAINEL,
      JANELA,
    );

    assert.equal(posicao.left, JANELA.width - PAINEL.width - MARGEM_DO_PAINEL);
  });

  it("never passes the left edge of the window", () => {
    const posicao = posicaoDoPainel(
      { top: 100, bottom: 130, left: -40 },
      PAINEL,
      JANELA,
    );

    assert.equal(posicao.left, MARGEM_DO_PAINEL);
  });

  it("keeps the margin on a window narrower than the panel", () => {
    const posicao = posicaoDoPainel(
      { top: 100, bottom: 130, left: 50 },
      PAINEL,
      { width: 200, height: 800 },
    );

    assert.equal(posicao.left, MARGEM_DO_PAINEL);
  });
});
