import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { fichasDoEstudante } from "./fichasDoEstudante";
import {
  ADMIN,
  PROFISSIONAL_EDUCACAO,
  PROFISSIONAL_NAPNE,
  PROFISSIONAL_SAUDE,
} from "../consts";

const ROTULOS = ["Triagem", "Anamnese", "Estudo de Caso", "Anotações Multiprofissionais", "PEI"];
const ROTULOS_SEM_ANAMNESE = ["Triagem", "Estudo de Caso", "Anotações Multiprofissionais", "PEI"];
const NIVEL_CRIADO_PELO_ADMIN = 7;

describe("fichasDoEstudante", () => {
  for (const [nome, nivel] of [
    ["administrator", ADMIN],
    ["education professional", PROFISSIONAL_EDUCACAO],
    ["health professional", PROFISSIONAL_SAUDE],
  ] as const) {
    it(`does not give the ${nome} the anamnesis card, whose page the middleware denies`, () => {
      assert.deepEqual(
        fichasDoEstudante(nivel).map((ficha) => ficha.label),
        ROTULOS_SEM_ANAMNESE,
      );
    });
  }

  it("gives the NAPNE professional the five cards", () => {
    assert.deepEqual(
      fichasDoEstudante(PROFISSIONAL_NAPNE).map((ficha) => ficha.label),
      ROTULOS,
    );
  });

  it("keeps the route of each card", () => {
    assert.deepEqual(
      fichasDoEstudante(PROFISSIONAL_NAPNE).map((ficha) => ficha.rota),
      ["/triagem", "/anamnese", "/estudo-de-caso", "/comentarios", "/pei"],
    );
  });

  it("gives no card to a level that opens none of the pages", () => {
    assert.deepEqual(fichasDoEstudante(NIVEL_CRIADO_PELO_ADMIN), []);
  });
});
