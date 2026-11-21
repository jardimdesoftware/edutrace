import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  ADMIN,
  ESTUDANTE,
  PROFESSOR_AEE,
  PROFISSIONAL_EDUCACAO,
  PROFISSIONAL_NAPNE,
  PROFISSIONAL_SAUDE,
} from "@/consts";
import { rotaDoCadastro } from "./rotaDoCadastro";

describe("rotaDoCadastro", () => {
  it("sends the administrator to the admin registration page", () => {
    assert.equal(rotaDoCadastro([ADMIN]), "/admin/usuarios/cadastro");
  });

  it("sends the NAPNE professional to the NAPNE registration page", () => {
    assert.equal(rotaDoCadastro([PROFISSIONAL_NAPNE]), "/napne/usuarios/cadastro");
    assert.equal(
      rotaDoCadastro([PROFISSIONAL_EDUCACAO, PROFISSIONAL_NAPNE]),
      "/napne/usuarios/cadastro",
    );
  });

  it("uses the admin page when the account has the administrator and NAPNE roles", () => {
    assert.equal(rotaDoCadastro([ADMIN, PROFISSIONAL_NAPNE]), "/admin/usuarios/cadastro");
  });

  it("has no registration page for the other roles or for a missing session", () => {
    for (const roles of [[ESTUDANTE], [PROFISSIONAL_EDUCACAO], [PROFISSIONAL_SAUDE], [PROFESSOR_AEE], [], null, undefined]) {
      assert.equal(rotaDoCadastro(roles), null);
    }
  });
});
