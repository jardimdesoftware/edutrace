import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { StudentData } from "../interfaces/StudentData";
import {
  OPCOES_FILTRO_PAPEL,
  filtrarPorPapel,
  lerFiltroPapel,
} from "./filtroPorPapel";
import {
  ADMIN,
  ESTUDANTE,
  PROFESSOR_AEE,
  PROFISSIONAL_EDUCACAO,
  PROFISSIONAL_NAPNE,
  PROFISSIONAL_SAUDE,
} from "../consts";

function usuario(id: number, roles: number[]): StudentData {
  return { id, roles } as StudentData;
}

const LISTA = [
  usuario(1, [ADMIN]),
  usuario(2, [ESTUDANTE]),
  usuario(3, [PROFISSIONAL_NAPNE]),
  usuario(4, [PROFISSIONAL_NAPNE, PROFESSOR_AEE]),
  usuario(5, [PROFISSIONAL_EDUCACAO, PROFESSOR_AEE]),
];

const idsDe = (usuarios: StudentData[]) => usuarios.map((u) => u.id);

describe("OPCOES_FILTRO_PAPEL", () => {
  it("starts with Todos and lists the six roles of the system by their labels", () => {
    assert.deepEqual(
      OPCOES_FILTRO_PAPEL.map((opcao) => opcao.label),
      [
        "Todos",
        "Administrador",
        "Estudante/Família",
        "Profissional da Educação",
        "Profissional da Saúde",
        "Profissional NAPNE",
        "Professor(a) do AEE",
      ],
    );
    assert.equal(OPCOES_FILTRO_PAPEL[0].value, "TODOS");
  });

  it("carries the id of each role as the value", () => {
    assert.deepEqual(
      OPCOES_FILTRO_PAPEL.slice(1).map((opcao) => opcao.value),
      [ADMIN, ESTUDANTE, PROFISSIONAL_EDUCACAO, PROFISSIONAL_SAUDE, PROFISSIONAL_NAPNE, PROFESSOR_AEE],
    );
  });
});

describe("lerFiltroPapel", () => {
  it("reads the id of a role from the text of the select", () => {
    assert.equal(lerFiltroPapel(String(PROFISSIONAL_NAPNE)), PROFISSIONAL_NAPNE);
    assert.equal(lerFiltroPapel(String(ADMIN)), ADMIN);
  });

  it("goes back to Todos for anything that is not a role of the system", () => {
    for (const valor of ["TODOS", "", "abc", "0", "7", "-1", "2.5"]) {
      assert.equal(lerFiltroPapel(valor), "TODOS", valor);
    }
  });
});

describe("filtrarPorPapel", () => {
  it("keeps the whole list, in the order it came, with Todos", () => {
    assert.deepEqual(idsDe(filtrarPorPapel(LISTA, "TODOS")), [1, 2, 3, 4, 5]);
  });

  it("does not hand back the same array, so the caller may sort it", () => {
    assert.notEqual(filtrarPorPapel(LISTA, "TODOS"), LISTA);
  });

  it("keeps the accounts that have the role, including those that accumulate others", () => {
    assert.deepEqual(idsDe(filtrarPorPapel(LISTA, PROFISSIONAL_NAPNE)), [3, 4]);
    assert.deepEqual(idsDe(filtrarPorPapel(LISTA, PROFESSOR_AEE)), [4, 5]);
  });

  it("keeps the exclusive roles alone", () => {
    assert.deepEqual(idsDe(filtrarPorPapel(LISTA, ADMIN)), [1]);
    assert.deepEqual(idsDe(filtrarPorPapel(LISTA, ESTUDANTE)), [2]);
  });

  it("answers an empty list for a role nobody has", () => {
    assert.deepEqual(filtrarPorPapel(LISTA, PROFISSIONAL_SAUDE), []);
  });
});
