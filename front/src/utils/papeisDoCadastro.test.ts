import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { papeisDoCadastro } from "./papeisDoCadastro";
import {
  ADMIN,
  ESTUDANTE,
  PROFESSOR_AEE,
  PROFISSIONAL_EDUCACAO,
  PROFISSIONAL_NAPNE,
  PROFISSIONAL_SAUDE,
} from "../consts";

describe("papeisDoCadastro", () => {
  it("offers the six roles to the administrator", () => {
    assert.deepEqual(
      [...papeisDoCadastro([ADMIN])].sort(),
      [1, 2, 3, 4, 5, 6],
    );
  });

  it("offers only the student role to the NAPNE professional, as POST /users in the back accepts only that one", () => {
    assert.deepEqual(papeisDoCadastro([PROFISSIONAL_NAPNE]), [ESTUDANTE]);
  });

  it("offers only the student role to a NAPNE professional who also has other professional roles", () => {
    assert.deepEqual(papeisDoCadastro([PROFISSIONAL_NAPNE, PROFESSOR_AEE]), [ESTUDANTE]);
  });

  it("offers no role to the others, which cannot register users, not even to the AEE teacher alone", () => {
    for (const roles of [
      [ESTUDANTE],
      [PROFISSIONAL_EDUCACAO],
      [PROFISSIONAL_SAUDE],
      [PROFESSOR_AEE],
      [PROFISSIONAL_EDUCACAO, PROFISSIONAL_SAUDE],
      [7],
      undefined,
    ]) {
      assert.deepEqual(papeisDoCadastro(roles), [], String(roles));
    }
  });
});
