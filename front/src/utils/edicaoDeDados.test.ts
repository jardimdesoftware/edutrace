import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { StudentData } from "@/interfaces/StudentData";
import { alteracoesDaEdicao, camposIniciais } from "./edicaoDeDados";

const estudante = {
  id: 7,
  full_name: "Diego Alves",
  cpf: "***.000.004-**",
  email: "estudante04@edutrace.com",
  enrollment_number: null,
  course: null,
  roles: [2],
} as unknown as StudentData;

describe("camposIniciais", () => {
  it("começa com o CPF vazio, porque a lista só tem o CPF mascarado", () => {
    assert.deepEqual(camposIniciais(estudante), {
      full_name: "Diego Alves",
      email: "estudante04@edutrace.com",
      cpf: "",
      enrollment_number: "",
      course: "",
    });
  });
});

describe("alteracoesDaEdicao", () => {
  it("não envia nada quando nada mudou", () => {
    assert.deepEqual(alteracoesDaEdicao(estudante, camposIniciais(estudante), true), {});
  });

  it("envia só os campos alterados, sem espaços nas pontas e o CPF só com dígitos", () => {
    const campos = {
      ...camposIniciais(estudante),
      full_name: " Diego Alves Silva ",
      email: " diego@edutrace.com ",
      cpf: "529.982.247-25",
      enrollment_number: " 20261TADS0012 ",
      course: "Licenciatura: Música",
    };

    assert.deepEqual(alteracoesDaEdicao(estudante, campos, true), {
      full_name: "Diego Alves Silva",
      email: "diego@edutrace.com",
      cpf: "52998224725",
      enrollment_number: "20261TADS0012",
      course: "Licenciatura: Música",
    });
  });

  it("não envia matrícula nem curso de quem não é estudante", () => {
    const campos = {
      ...camposIniciais(estudante),
      enrollment_number: "123",
      course: "Licenciatura: Música",
    };

    assert.deepEqual(alteracoesDaEdicao(estudante, campos, false), {});
  });

  it("não envia o curso vazio (opção \"Selecione o curso\")", () => {
    const comCurso = { ...estudante, course: "Licenciatura: Música" };
    const campos = { ...camposIniciais(comCurso), course: "" };

    assert.deepEqual(alteracoesDaEdicao(comCurso, campos, true), {});
  });

  it("não reenvia o curso já gravado", () => {
    const comCurso = { ...estudante, course: "Licenciatura: Música" };

    assert.deepEqual(alteracoesDaEdicao(comCurso, camposIniciais(comCurso), true), {});
  });
});
