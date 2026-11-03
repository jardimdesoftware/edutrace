import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  DIAS_DE_CARENCIA,
  MOTIVO_PROPRIA_CONTA,
  corpoDaExclusao,
  dataDaExclusao,
  estaMarcado,
  janelaDeSenhaAberta,
  motivoDaLixeiraDesativada,
  podeExcluir,
  podeRestaurar,
  textoDaExclusao,
} from "./exclusaoDeUsuario";
import {
  ADMIN,
  ESTUDANTE,
  PROFISSIONAL_NAPNE,
} from "../consts";

const MARCADO_EM = "2026-11-03T12:00:00.000Z";

const admin = { sub: 1, roles: [ADMIN] };
const napne = { sub: 2, roles: [PROFISSIONAL_NAPNE] };

describe("estaMarcado", () => {
  it("is true only when deleted_at has a value", () => {
    assert.equal(estaMarcado({ deleted_at: MARCADO_EM }), true);
    assert.equal(estaMarcado({ deleted_at: null }), false);
  });
});

describe("dataDaExclusao e textoDaExclusao", () => {
  it("adds the 7 days of grace to the day of the mark", () => {
    assert.equal(DIAS_DE_CARENCIA, 7);
    assert.equal(
      dataDaExclusao(MARCADO_EM).toISOString(),
      "2026-11-10T12:00:00.000Z",
    );
  });

  it("writes the day in the local calendar, as dd/mm/aaaa", () => {
    assert.equal(textoDaExclusao(MARCADO_EM), "Exclusão em 10/11/2026");
  });

  it("keeps the local day when the mark is close to midnight in Recife", () => {
    // 02:30 UTC ainda é o dia anterior em Recife (UTC-3).
    assert.equal(
      textoDaExclusao("2026-11-03T02:30:00.000Z"),
      "Exclusão em 09/11/2026",
    );
  });
});

describe("podeExcluir", () => {
  it("lets the administrator delete another user", () => {
    assert.equal(podeExcluir(admin, { id: 7, deleted_at: null }), true);
  });

  it("denies the administrator on his own account", () => {
    assert.equal(podeExcluir(admin, { id: 1, deleted_at: null }), false);
  });

  it("denies a user that is already marked", () => {
    assert.equal(podeExcluir(admin, { id: 7, deleted_at: MARCADO_EM }), false);
  });

  it("denies any level that is not the administrator", () => {
    for (const roles of [[ESTUDANTE], [PROFISSIONAL_NAPNE]]) {
      assert.equal(
        podeExcluir({ sub: 2, roles }, { id: 7, deleted_at: null }),
        false,
      );
    }
  });

  it("denies a session without user", () => {
    assert.equal(podeExcluir(null, { id: 7, deleted_at: null }), false);
    assert.equal(podeExcluir(undefined, { id: 7, deleted_at: null }), false);
  });
});

describe("podeRestaurar", () => {
  it("lets the administrator restore only a marked user", () => {
    assert.equal(podeRestaurar(admin, { deleted_at: MARCADO_EM }), true);
    assert.equal(podeRestaurar(admin, { deleted_at: null }), false);
  });

  it("denies the levels that are not the administrator", () => {
    assert.equal(podeRestaurar(napne, { deleted_at: MARCADO_EM }), false);
    assert.equal(podeRestaurar(null, { deleted_at: MARCADO_EM }), false);
  });
});

describe("motivoDaLixeiraDesativada", () => {
  it("explains the block on the own account", () => {
    assert.equal(motivoDaLixeiraDesativada(admin, { id: 1 }), MOTIVO_PROPRIA_CONTA);
  });

  it("gives no reason for another user", () => {
    assert.equal(motivoDaLixeiraDesativada(admin, { id: 7 }), null);
  });
});

describe("janelaDeSenhaAberta", () => {
  const agora = new Date("2026-11-03T12:05:00.000Z");

  it("is open until the end the back answered", () => {
    assert.equal(janelaDeSenhaAberta("2026-11-03T12:10:00.000Z", agora), true);
  });

  it("is closed at the end instant and after it", () => {
    assert.equal(janelaDeSenhaAberta("2026-11-03T12:05:00.000Z", agora), false);
    assert.equal(janelaDeSenhaAberta("2026-11-03T12:00:00.000Z", agora), false);
  });

  it("is closed without a value or with an invalid one", () => {
    assert.equal(janelaDeSenhaAberta(null, agora), false);
    assert.equal(janelaDeSenhaAberta(undefined, agora), false);
    assert.equal(janelaDeSenhaAberta("amanhã", agora), false);
  });
});

describe("corpoDaExclusao", () => {
  it("sends only the password when the administrator does not ask to remember", () => {
    assert.deepEqual(corpoDaExclusao("senha", false), { currentPassword: "senha" });
  });

  it("sends remember with the password", () => {
    assert.deepEqual(corpoDaExclusao("senha", true), {
      currentPassword: "senha",
      remember: true,
    });
  });

  it("sends an empty body while the window is open, even if the box is checked", () => {
    assert.deepEqual(corpoDaExclusao("", true), {});
    assert.deepEqual(corpoDaExclusao("", false), {});
  });
});
