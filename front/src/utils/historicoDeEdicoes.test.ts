import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  ADMIN,
  ESTUDANTE,
  PROFESSOR_AEE,
  PROFISSIONAL_EDUCACAO,
  PROFISSIONAL_NAPNE,
  PROFISSIONAL_SAUDE,
} from "../consts";
import {
  MAXIMO_DE_VERSOES,
  formatarDataEHora,
  limiteDeVersoesAtingido,
  ordenarDaMaisRecente,
  podeVerHistorico,
  resumoDeAutoria,
  type TipoDeFormulario,
  type VersaoResumida,
} from "./historicoDeEdicoes";

const versao = (version: number, author_name: string, created_at: string): VersaoResumida => ({
  version,
  author_name,
  created_at,
});

describe("podeVerHistorico", () => {
  const TIPOS: TipoDeFormulario[] = ["SCREENING", "ANAMNESIS", "CASE_STUDY", "AEE_PLAN"];

  for (const tipo of TIPOS) {
    it(`never shows the ${tipo} history to the student nor the administrator`, () => {
      assert.equal(podeVerHistorico(tipo, [ESTUDANTE]), false);
      assert.equal(podeVerHistorico(tipo, [ADMIN]), false);
    });
  }

  it("follows the levels that read each form in the back", () => {
    assert.equal(podeVerHistorico("ANAMNESIS", [PROFISSIONAL_EDUCACAO]), false);
    for (const nivel of [PROFISSIONAL_SAUDE, PROFISSIONAL_NAPNE, PROFESSOR_AEE]) {
      assert.equal(podeVerHistorico("ANAMNESIS", [nivel]), true);
    }
    for (const tipo of ["SCREENING", "CASE_STUDY", "AEE_PLAN"] as const) {
      assert.equal(podeVerHistorico(tipo, [PROFISSIONAL_EDUCACAO]), true);
    }
  });

  it("opens the history when any of the roles may read it", () => {
    assert.equal(podeVerHistorico("ANAMNESIS", [PROFISSIONAL_EDUCACAO, PROFESSOR_AEE]), true);
  });

  it("denies a session without roles", () => {
    assert.equal(podeVerHistorico("SCREENING", []), false);
    assert.equal(podeVerHistorico("SCREENING", undefined), false);
  });
});

describe("ordenarDaMaisRecente", () => {
  it("puts the highest version first without changing the original list", () => {
    const original = [versao(1, "A", "2026-01-01T00:00:00Z"), versao(3, "C", "2026-03-01T00:00:00Z"), versao(2, "B", "2026-02-01T00:00:00Z")];

    assert.deepEqual(
      ordenarDaMaisRecente(original).map((v) => v.version),
      [3, 2, 1],
    );
    assert.deepEqual(
      original.map((v) => v.version),
      [1, 3, 2],
    );
  });
});

describe("limiteDeVersoesAtingido", () => {
  it("is true only at the maximum of versions", () => {
    const lista = (n: number) =>
      Array.from({ length: n }, (_, i) => versao(i + 1, "A", "2026-01-01T00:00:00Z"));

    assert.equal(MAXIMO_DE_VERSOES, 5);
    assert.equal(limiteDeVersoesAtingido(lista(4)), false);
    assert.equal(limiteDeVersoesAtingido(lista(5)), true);
  });
});

describe("formatarDataEHora", () => {
  it("formats the date and the time in the Recife time zone", () => {
    assert.equal(formatarDataEHora("2026-11-05T15:30:00.000Z"), "05/11/2026, 12:30");
  });

  it("does not break on an invalid date", () => {
    assert.equal(formatarDataEHora("isto nao e data"), "data desconhecida");
  });
});

describe("resumoDeAutoria", () => {
  it("returns nothing for a form without history", () => {
    assert.equal(resumoDeAutoria([]), null);
  });

  it("shows only the creation for a form that was never edited", () => {
    assert.deepEqual(resumoDeAutoria([versao(1, "Ana", "2026-11-05T15:30:00Z")]), {
      criadoPor: "Ana",
      criadoEm: "05/11/2026, 12:30",
      editadoPor: null,
      editadoEm: null,
    });
  });

  it("shows the creator and the last editor whatever the order of the list", () => {
    const resumo = resumoDeAutoria([
      versao(3, "Carla", "2026-11-07T15:30:00Z"),
      versao(1, "Ana", "2026-11-05T15:30:00Z"),
      versao(2, "Bia", "2026-11-06T15:30:00Z"),
    ]);

    assert.equal(resumo?.criadoPor, "Ana");
    assert.equal(resumo?.editadoPor, "Carla");
    assert.equal(resumo?.editadoEm, "07/11/2026, 12:30");
  });
});
