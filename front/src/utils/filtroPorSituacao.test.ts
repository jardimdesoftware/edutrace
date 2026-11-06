import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  OPCOES_FILTRO_SITUACAO,
  SITUACAO_PADRAO,
  lerFiltroSituacao,
  permaneceNaSituacao,
} from "./filtroPorSituacao";

const ATIVO = { deleted_at: null, deactivated_at: null };
const EM_CARENCIA = { deleted_at: "2026-11-01T00:00:00Z", deactivated_at: null };
const DESATIVADO = {
  deleted_at: "2026-10-01T00:00:00Z",
  deactivated_at: "2026-10-08T00:00:00Z",
};

describe("OPCOES_FILTRO_SITUACAO", () => {
  it("starts with the default list, which shows active users and the grace period", () => {
    assert.equal(OPCOES_FILTRO_SITUACAO[0].value, SITUACAO_PADRAO);
    assert.equal(OPCOES_FILTRO_SITUACAO[0].label, "Ativos e em carência");
  });

  it("offers the grace period and the deactivated users", () => {
    assert.deepEqual(
      OPCOES_FILTRO_SITUACAO.map((opcao) => opcao.value),
      ["padrao", "carencia", "desativados"],
    );
  });
});

describe("lerFiltroSituacao", () => {
  it("reads the three values the back accepts", () => {
    assert.equal(lerFiltroSituacao("carencia"), "carencia");
    assert.equal(lerFiltroSituacao("desativados"), "desativados");
    assert.equal(lerFiltroSituacao("padrao"), "padrao");
  });

  it("goes back to the default list for anything else", () => {
    for (const valor of ["", "todos", "DESATIVADOS", "1", "deleted_at"]) {
      assert.equal(lerFiltroSituacao(valor), "padrao", valor);
    }
  });
});

describe("permaneceNaSituacao", () => {
  it("keeps active users and the grace period in the default list, never the deactivated ones", () => {
    assert.equal(permaneceNaSituacao(ATIVO, "padrao"), true);
    assert.equal(permaneceNaSituacao(EM_CARENCIA, "padrao"), true);
    assert.equal(permaneceNaSituacao(DESATIVADO, "padrao"), false);
  });

  it("keeps in the grace list only who is in the grace period", () => {
    assert.equal(permaneceNaSituacao(EM_CARENCIA, "carencia"), true);
    assert.equal(permaneceNaSituacao(ATIVO, "carencia"), false);
    assert.equal(permaneceNaSituacao(DESATIVADO, "carencia"), false);
  });

  it("keeps in the deactivated list only the deactivated users, so a reactivated one leaves it", () => {
    assert.equal(permaneceNaSituacao(DESATIVADO, "desativados"), true);
    assert.equal(permaneceNaSituacao(ATIVO, "desativados"), false);
    assert.equal(permaneceNaSituacao(EM_CARENCIA, "desativados"), false);
  });
});
