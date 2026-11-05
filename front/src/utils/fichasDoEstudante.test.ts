import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { fichasDoEstudante } from "./fichasDoEstudante";
import {
  ADMIN,
  PROFESSOR_AEE,
  PROFISSIONAL_EDUCACAO,
  PROFISSIONAL_NAPNE,
  PROFISSIONAL_SAUDE,
} from "../consts";

const ROTULOS = [
  "Triagem",
  "Anamnese",
  "Estudo de Caso",
  "PAEE",
  "Anotações Multiprofissionais",
  "PEI",
];
const ROTULOS_SEM_ANAMNESE = [
  "Triagem",
  "Estudo de Caso",
  "PAEE",
  "Anotações Multiprofissionais",
  "PEI",
];
const NIVEL_CRIADO_PELO_ADMIN = 7;

describe("fichasDoEstudante", () => {
  it("does not give the education professional the anamnesis card, whose page the middleware denies", () => {
    assert.deepEqual(
      fichasDoEstudante([PROFISSIONAL_EDUCACAO]).map((ficha) => ficha.label),
      ROTULOS_SEM_ANAMNESE,
    );
  });

  it("gives the health professional the anamnesis card, which opens in read mode", () => {
    assert.deepEqual(
      fichasDoEstudante([PROFISSIONAL_SAUDE]).map((ficha) => ficha.label),
      ROTULOS,
    );
  });

  it("gives the NAPNE professional the six cards", () => {
    assert.deepEqual(
      fichasDoEstudante([PROFISSIONAL_NAPNE]).map((ficha) => ficha.label),
      ROTULOS,
    );
  });

  it("keeps the route of each card", () => {
    assert.deepEqual(
      fichasDoEstudante([PROFISSIONAL_NAPNE]).map((ficha) => ficha.rota),
      ["/triagem", "/anamnese", "/estudo-de-caso", "/paee", "/comentarios", "/pei"],
    );
  });

  it("gives no card to a level that opens none of the pages", () => {
    assert.deepEqual(fichasDoEstudante([NIVEL_CRIADO_PELO_ADMIN]), []);
  });

  it("gives no card to the administrator, who only manages users", () => {
    assert.deepEqual(fichasDoEstudante([ADMIN]), []);
  });
});

describe("fichasDoEstudante with the AEE teacher", () => {
  it("gives the AEE teacher alone the six cards, the anamnesis in read mode", () => {
    assert.deepEqual(
      fichasDoEstudante([PROFESSOR_AEE]).map((ficha) => ficha.label),
      ROTULOS,
    );
  });

  it("gives the six cards to NAPNE plus AEE", () => {
    assert.deepEqual(
      fichasDoEstudante([PROFISSIONAL_NAPNE, PROFESSOR_AEE]).map((ficha) => ficha.label),
      ROTULOS,
    );
  });
});
