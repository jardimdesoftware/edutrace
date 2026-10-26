import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  ROTULO_DO_PAPEL,
  alternarPapel,
  erroDosPapeis,
  estadoDoRascunhoDePapeis,
  rotulosDosPapeis,
  temPapel,
} from "./papeis";
import {
  ADMIN,
  ESTUDANTE,
  PROFESSOR_AEE,
  PROFISSIONAL_EDUCACAO,
  PROFISSIONAL_NAPNE,
  PROFISSIONAL_SAUDE,
} from "../consts";

describe("temPapel", () => {
  it("is true when the list has any of the roles asked", () => {
    assert.equal(temPapel([PROFISSIONAL_NAPNE, PROFESSOR_AEE], PROFESSOR_AEE), true);
    assert.equal(temPapel([PROFISSIONAL_SAUDE], ADMIN, PROFISSIONAL_SAUDE), true);
  });

  it("is false when the list has none of the roles asked", () => {
    assert.equal(temPapel([PROFISSIONAL_NAPNE], PROFESSOR_AEE), false);
    assert.equal(temPapel([PROFISSIONAL_NAPNE, PROFESSOR_AEE], ADMIN, ESTUDANTE), false);
  });

  it("is false without a session or without roles", () => {
    assert.equal(temPapel(undefined, ADMIN), false);
    assert.equal(temPapel(null, ADMIN), false);
    assert.equal(temPapel([], ADMIN), false);
  });
});

describe("ROTULO_DO_PAPEL", () => {
  it("names the six roles of the contract", () => {
    assert.deepEqual(ROTULO_DO_PAPEL, {
      1: "Administrador",
      2: "Estudante/Família",
      3: "Profissional da Educação",
      4: "Profissional da Saúde",
      5: "Profissional NAPNE",
      6: "Professor(a) do AEE",
    });
  });
});

describe("rotulosDosPapeis", () => {
  it("lists every role in ascending order, whatever the order received", () => {
    assert.deepEqual(rotulosDosPapeis([6, 5]), [
      "Profissional NAPNE",
      "Professor(a) do AEE",
    ]);
  });

  it("names a role the front does not know instead of hiding it", () => {
    assert.deepEqual(rotulosDosPapeis([3, 99]), [
      "Profissional da Educação",
      "Papel desconhecido",
    ]);
  });

  it("returns an empty list without roles", () => {
    assert.deepEqual(rotulosDosPapeis(undefined), []);
    assert.deepEqual(rotulosDosPapeis([]), []);
  });
});

describe("alternarPapel", () => {
  it("checking Admin clears every other role", () => {
    assert.deepEqual(alternarPapel([PROFISSIONAL_NAPNE, PROFESSOR_AEE], ADMIN, true), [ADMIN]);
  });

  it("checking Student clears every other role", () => {
    assert.deepEqual(alternarPapel([PROFISSIONAL_SAUDE], ESTUDANTE, true), [ESTUDANTE]);
  });

  it("checking a professional role clears Admin", () => {
    assert.deepEqual(alternarPapel([ADMIN], PROFISSIONAL_NAPNE, true), [PROFISSIONAL_NAPNE]);
  });

  it("checking a professional role clears Student", () => {
    assert.deepEqual(alternarPapel([ESTUDANTE], PROFESSOR_AEE, true), [PROFESSOR_AEE]);
  });

  it("lets the professional roles accumulate, in ascending order", () => {
    assert.deepEqual(alternarPapel([PROFESSOR_AEE], PROFISSIONAL_EDUCACAO, true), [
      PROFISSIONAL_EDUCACAO,
      PROFESSOR_AEE,
    ]);
    assert.deepEqual(alternarPapel([PROFISSIONAL_SAUDE, PROFISSIONAL_NAPNE], PROFESSOR_AEE, true), [
      PROFISSIONAL_SAUDE,
      PROFISSIONAL_NAPNE,
      PROFESSOR_AEE,
    ]);
  });

  it("does not repeat a role checked twice", () => {
    assert.deepEqual(alternarPapel([PROFISSIONAL_NAPNE], PROFISSIONAL_NAPNE, true), [
      PROFISSIONAL_NAPNE,
    ]);
  });

  it("unchecking removes only that role", () => {
    assert.deepEqual(alternarPapel([PROFISSIONAL_NAPNE, PROFESSOR_AEE], PROFESSOR_AEE, false), [
      PROFISSIONAL_NAPNE,
    ]);
  });

  it("does not mutate the list received", () => {
    const atuais = [PROFISSIONAL_NAPNE];
    alternarPapel(atuais, PROFESSOR_AEE, true);
    assert.deepEqual(atuais, [PROFISSIONAL_NAPNE]);
  });
});

describe("erroDosPapeis", () => {
  it("accepts one role, Admin or Student alone, and any mix of professionals", () => {
    for (const roles of [[1], [2], [3], [5, 6], [3, 4, 5, 6]]) {
      assert.equal(erroDosPapeis(roles), null, roles.join(","));
    }
  });

  it("refuses an empty list, so the submit is never sent without a role", () => {
    assert.match(erroDosPapeis([]) ?? "", /ao menos um papel/);
  });

  it("refuses Admin or Student together with another role", () => {
    assert.notEqual(erroDosPapeis([ADMIN, PROFISSIONAL_NAPNE]), null);
    assert.notEqual(erroDosPapeis([ESTUDANTE, PROFESSOR_AEE]), null);
    assert.notEqual(erroDosPapeis([ADMIN, ESTUDANTE]), null);
  });

  it("refuses a repeated role and a role out of 1 to 6", () => {
    assert.notEqual(erroDosPapeis([5, 5]), null);
    assert.notEqual(erroDosPapeis([7]), null);
    assert.notEqual(erroDosPapeis([0]), null);
  });
});

describe("estadoDoRascunhoDePapeis", () => {
  it("is unchanged and not savable when the draft equals the saved list, in any order", () => {
    const igual = estadoDoRascunhoDePapeis([5, 6], [6, 5]);
    assert.deepEqual(igual, { alterado: false, erro: null, podeSalvar: false });
  });

  it("is changed and savable when the draft is a valid different list", () => {
    assert.deepEqual(estadoDoRascunhoDePapeis([5], [5, 6]), {
      alterado: true,
      erro: null,
      podeSalvar: true,
    });
    assert.equal(estadoDoRascunhoDePapeis([5, 6], [5]).podeSalvar, true);
  });

  it("an empty draft is changed, carries the message and blocks the save", () => {
    const vazio = estadoDoRascunhoDePapeis([5], []);
    assert.equal(vazio.alterado, true);
    assert.match(vazio.erro ?? "", /ao menos um papel/);
    assert.equal(vazio.podeSalvar, false);
  });

  it("an invalid mix is changed, carries the message and blocks the save", () => {
    const mistura = estadoDoRascunhoDePapeis([5], [ADMIN, PROFISSIONAL_NAPNE]);
    assert.equal(mistura.alterado, true);
    assert.notEqual(mistura.erro, null);
    assert.equal(mistura.podeSalvar, false);
  });
});
