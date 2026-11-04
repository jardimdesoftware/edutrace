import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { CURSOS, ehCurso, podeAlterarCurso } from "./cursos";

describe("CURSOS", () => {
  it("lists the ten courses of the institution, without repetition", () => {
    assert.equal(CURSOS.length, 10);
    assert.equal(new Set(CURSOS).size, 10);
  });
});

describe("ehCurso", () => {
  it("accepts every course of the list", () => {
    for (const curso of CURSOS) {
      assert.equal(ehCurso(curso), true);
    }
  });

  it("refuses text outside the list, empty text and nothing", () => {
    assert.equal(ehCurso("Informática"), false);
    assert.equal(ehCurso("integrado: informática"), false);
    assert.equal(ehCurso(""), false);
    assert.equal(ehCurso(null), false);
    assert.equal(ehCurso(undefined), false);
  });
});

describe("podeAlterarCurso", () => {
  const estudante = { roles: [2] };

  it("allows the NAPNE professional on a student", () => {
    assert.equal(podeAlterarCurso({ roles: [5] }, estudante), true);
    assert.equal(podeAlterarCurso({ roles: [5, 6] }, estudante), true);
  });

  it("refuses every other profile", () => {
    for (const roles of [[1], [2], [3], [4], [6]]) {
      assert.equal(podeAlterarCurso({ roles }, estudante), false);
    }
  });

  it("refuses when the target is not a student or there is no session", () => {
    assert.equal(podeAlterarCurso({ roles: [5] }, { roles: [3] }), false);
    assert.equal(podeAlterarCurso({ roles: [5] }, null), false);
    assert.equal(podeAlterarCurso(null, estudante), false);
  });
});
