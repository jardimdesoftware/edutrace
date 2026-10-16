import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  LIMITE_ATENDIMENTO_MAX,
  validarLimiteAtendimento,
} from "./limiteAtendimento";

const ERRO_FAIXA = `Informe um número inteiro de 0 a ${LIMITE_ATENDIMENTO_MAX}.`;

describe("validarLimiteAtendimento", () => {
  for (const [entrada, esperado] of [
    ["0", 0],
    ["1", 1],
    ["15", 15],
    ["200", 200],
    ["  8  ", 8],
    ["007", 7],
  ] as const) {
    it(`accepts "${entrada}" as ${esperado}`, () => {
      assert.deepEqual(validarLimiteAtendimento(entrada), { ok: true, value: esperado });
    });
  }

  for (const entrada of ["", "   "]) {
    it(`asks for a value when the field is ${JSON.stringify(entrada)}`, () => {
      assert.deepEqual(validarLimiteAtendimento(entrada), {
        ok: false,
        error: "Informe o limite de atendimento.",
      });
    });
  }

  for (const entrada of ["201", "1000", "99999999999999999999"]) {
    it(`refuses "${entrada}", above the maximum`, () => {
      assert.deepEqual(validarLimiteAtendimento(entrada), { ok: false, error: ERRO_FAIXA });
    });
  }

  for (const entrada of ["-1", "1.5", "1,5", "1e2", "0x10", "abc", "+3", "٣"]) {
    it(`refuses "${entrada}", which is not a non-negative integer`, () => {
      assert.deepEqual(validarLimiteAtendimento(entrada), { ok: false, error: ERRO_FAIXA });
    });
  }
});
