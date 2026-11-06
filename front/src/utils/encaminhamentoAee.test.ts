import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  podeEncaminhar,
  podeEscolherProfessor,
  recebeAvisosDeEncaminhamento,
  textoDaConfirmacaoDoEncaminhamento,
  textoDaDisponibilidade,
  textoDoAviso,
  tituloDosAvisos,
} from "./encaminhamentoAee";
import {
  ADMIN,
  ESTUDANTE,
  PROFESSOR_AEE,
  PROFISSIONAL_EDUCACAO,
  PROFISSIONAL_NAPNE,
  PROFISSIONAL_SAUDE,
} from "../consts";

describe("podeEncaminhar", () => {
  it("is true only for the NAPNE", () => {
    assert.equal(podeEncaminhar([PROFISSIONAL_NAPNE]), true);
    for (const nivel of [ADMIN, ESTUDANTE, PROFISSIONAL_EDUCACAO, PROFISSIONAL_SAUDE, PROFESSOR_AEE]) {
      assert.equal(podeEncaminhar([nivel]), false, String(nivel));
    }
  });

  it("opens for an account that accumulates the NAPNE with other roles", () => {
    assert.equal(podeEncaminhar([PROFISSIONAL_NAPNE, PROFESSOR_AEE]), true);
  });

  it("is false for a session without roles", () => {
    assert.equal(podeEncaminhar([]), false);
    assert.equal(podeEncaminhar(undefined), false);
  });
});

describe("recebeAvisosDeEncaminhamento", () => {
  it("is true only for the AEE teacher", () => {
    assert.equal(recebeAvisosDeEncaminhamento([PROFESSOR_AEE]), true);
    assert.equal(recebeAvisosDeEncaminhamento([PROFISSIONAL_NAPNE]), false);
    assert.equal(recebeAvisosDeEncaminhamento([ESTUDANTE]), false);
    assert.equal(recebeAvisosDeEncaminhamento(undefined), false);
  });
});

describe("textoDoAviso", () => {
  it("says who from the NAPNE referred which student to the teacher", () => {
    assert.equal(
      textoDoAviso({ kind: "ASSIGNED", student_name: "Maria Clara", from_name: "Ana NAPNE" }),
      "Ana NAPNE, do NAPNE, encaminhou o aluno Maria Clara para você.",
    );
  });

  it("says the student left the list of the teacher who lost him", () => {
    assert.equal(
      textoDoAviso({ kind: "REMOVED", student_name: "Maria Clara", from_name: "Ana NAPNE" }),
      "O aluno Maria Clara foi encaminhado a outro professor por Ana NAPNE e saiu da sua lista.",
    );
  });
});

describe("tituloDosAvisos", () => {
  it("is singular for one notice and counts the others", () => {
    assert.equal(tituloDosAvisos(1), "Novo aviso de encaminhamento");
    assert.equal(tituloDosAvisos(3), "3 novos avisos de encaminhamento");
  });
});

describe("textoDaDisponibilidade e podeEscolherProfessor", () => {
  it("shows the places left, in the singular and the plural", () => {
    assert.equal(
      textoDaDisponibilidade({ in_service: 3, capacity: 15, free: 12 }),
      "3 de 15 em atendimento, 12 vagas",
    );
    assert.equal(
      textoDaDisponibilidade({ in_service: 14, capacity: 15, free: 1 }),
      "14 de 15 em atendimento, 1 vaga",
    );
  });

  it("says there is no place for the teacher at the limit, and blocks him", () => {
    const cheio = { in_service: 15, capacity: 15, free: 0 };

    assert.equal(textoDaDisponibilidade(cheio), "15 de 15 em atendimento, sem vaga");
    assert.equal(podeEscolherProfessor(cheio), false);
    assert.equal(podeEscolherProfessor({ free: 1 }), true);
  });
});

describe("textoDaConfirmacaoDoEncaminhamento", () => {
  it("names the student and the teacher and says the student is assigned now", () => {
    assert.equal(
      textoDaConfirmacaoDoEncaminhamento("Maria Clara", "Beatriz AEE"),
      "Encaminhar Maria Clara para Beatriz AEE? O estudante passa a ser atendido por ele agora, e ele recebe um aviso.",
    );
  });

  it("falls back to o estudante when the name is unknown", () => {
    assert.match(textoDaConfirmacaoDoEncaminhamento(null, "Beatriz AEE"), /^Encaminhar o estudante para Beatriz AEE\?/);
    assert.match(textoDaConfirmacaoDoEncaminhamento("  ", "Beatriz AEE"), /^Encaminhar o estudante/);
  });
});
