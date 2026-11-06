import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  DIAS_DE_CARENCIA,
  MOTIVO_PROPRIA_CONTA,
  corpoDaExclusao,
  dataDaExclusao,
  estaDesativado,
  estaMarcado,
  janelaDeSenhaAberta,
  motivoDaLixeiraDesativada,
  podeExcluir,
  podeRestaurar,
  textoDaDesativacao,
  textoDoAvisoDaLixeira,
  textoDoSucessoDaLixeira,
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

describe("dataDaExclusao e textoDaDesativacao", () => {
  it("adds the 7 days of grace to the day of the mark", () => {
    assert.equal(DIAS_DE_CARENCIA, 7);
    assert.equal(
      dataDaExclusao(MARCADO_EM).toISOString(),
      "2026-11-10T12:00:00.000Z",
    );
  });

  it("writes the day in the local calendar, as dd/mm/aaaa", () => {
    assert.equal(textoDaDesativacao(MARCADO_EM), "Desativação em 10/11/2026");
  });

  it("keeps the local day when the mark is close to midnight in Recife", () => {
    // 02:30 UTC ainda é o dia anterior em Recife (UTC-3).
    assert.equal(
      textoDaDesativacao("2026-11-03T02:30:00.000Z"),
      "Desativação em 09/11/2026",
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

describe("estaDesativado", () => {
  it("is true only when deactivated_at has a value", () => {
    assert.equal(estaDesativado({ deactivated_at: null }), false);
    assert.equal(estaDesativado({ deactivated_at: undefined }), false);
    assert.equal(estaDesativado({ deactivated_at: "2026-11-10T00:00:00Z" }), true);
  });
});

describe("textoDoAvisoDaLixeira", () => {
  const alvo = { full_name: "Maria Clara", email: "maria@discente.ifpe.edu.br" };
  const AGORA = new Date("2026-11-03T12:00:00.000Z");

  it("says the account will be deactivated, keeping the data, when it has data", () => {
    const texto = textoDoAvisoDaLixeira(alvo, true, AGORA);

    assert.match(texto, /Maria Clara/);
    assert.match(texto, /maria@discente\.ifpe\.edu\.br/);
    assert.match(texto, /desativação pendente/);
    assert.match(texto, /Em 10\/11\/2026 ela será desativada, e os dados serão mantidos/);
    assert.match(texto, /você pode restaurar o acesso/);
    assert.doesNotMatch(texto, /excluída/);
  });

  it("says the account will be deleted, or deactivated if it gets data, when it has none", () => {
    const texto = textoDoAvisoDaLixeira(alvo, false, AGORA);

    assert.match(texto, /Em 10\/11\/2026 ela será excluída, porque não tem dados cadastrados/);
    assert.match(texto, /Se ganhar dados até lá, será desativada/);
  });

  it("describes both cases when the preview failed", () => {
    const texto = textoDoAvisoDaLixeira(alvo, null, AGORA);

    assert.match(texto, /Em 10\/11\/2026 ela será desativada, ou excluída se não tiver dados cadastrados/);
  });

  it("never writes the word in capital letters", () => {
    for (const temDados of [true, false, null]) {
      assert.doesNotMatch(textoDoAvisoDaLixeira(alvo, temDados, AGORA), /DELETAD/);
    }
  });

  it("uses the local day of Recife for the end of the grace period", () => {
    const quaseMeiaNoite = new Date("2026-11-03T02:30:00.000Z");

    assert.match(textoDoAvisoDaLixeira(alvo, true, quaseMeiaNoite), /Em 09\/11\/2026/);
  });
});

describe("textoDoSucessoDaLixeira", () => {
  it("gives the day and both outcomes", () => {
    assert.equal(
      textoDoSucessoDaLixeira(MARCADO_EM),
      "Em 10/11/2026, a conta será desativada, ou excluída se não tiver dados cadastrados. Até lá, você pode restaurar o acesso.",
    );
  });
});
