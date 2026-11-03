import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { niveisDoCadastro } from "./niveisDoCadastro";
import {
  ADMIN,
  ESTUDANTE,
  PROFISSIONAL_EDUCACAO,
  PROFISSIONAL_NAPNE,
  PROFISSIONAL_SAUDE,
} from "../consts";

const NIVEL_CRIADO_PELO_ADMIN = 7;

describe("niveisDoCadastro", () => {
  it("offers every level to the administrator, with the labels of the registration page", () => {
    assert.deepEqual(niveisDoCadastro(ADMIN), [
      { value: "1", label: "Administrador" },
      { value: "2", label: "Pais/Responsáveis e Estudante" },
      { value: "3", label: "Profissional da Educação" },
      { value: "4", label: "Profissional da Saúde" },
      { value: "5", label: "Profissional NAPNE" },
    ]);
  });

  it("offers only the student level to the NAPNE professional, as POST /users in the back accepts only that one", () => {
    assert.deepEqual(niveisDoCadastro(PROFISSIONAL_NAPNE), [
      { value: "2", label: "Pais/Responsáveis e Estudante" },
    ]);
  });

  it("offers no level to the other levels, which cannot register users", () => {
    for (const nivel of [
      ESTUDANTE,
      PROFISSIONAL_EDUCACAO,
      PROFISSIONAL_SAUDE,
      NIVEL_CRIADO_PELO_ADMIN,
      undefined,
    ]) {
      assert.deepEqual(niveisDoCadastro(nivel), [], String(nivel));
    }
  });
});
