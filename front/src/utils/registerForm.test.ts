import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  MATRICULA_PATTERN,
  buildRegisterData,
  cadastraEstudante,
} from "./registerForm";

const form = {
  nome: "  Maria Souza  ",
  email: "  Maria.Souza@Escola.Br  ",
  cpf: "111.444.777-35",
  id_level: "3",
  matricula: "",
  curso: "",
};

const estudante = {
  ...form,
  id_level: "2",
  matricula: "  20261TADS0012  ",
  curso: "  Análise e Desenvolvimento de Sistemas  ",
};

describe("buildRegisterData", () => {
  it("builds the payload with the cpf digits, the trimmed name and the level as number", () => {
    const result = buildRegisterData(form, true);

    assert.deepEqual(result, {
      ok: true,
      data: {
        full_name: "Maria Souza",
        email: "maria.souza@escola.br",
        cpf: "11144477735",
        id_level: 3,
      },
    });
  });

  it("refuses the submission while the consent term is not accepted", () => {
    assert.deepEqual(buildRegisterData(form, false), {
      ok: false,
      error: "É necessário aceitar o Termo de Consentimento.",
    });
  });

  it("refuses a cpf that does not have eleven digits", () => {
    assert.deepEqual(buildRegisterData({ ...form, cpf: "111.444.777" }, true), {
      ok: false,
      error: "O CPF deve ter 11 dígitos.",
    });
  });
});

describe("buildRegisterData, matrícula e curso do estudante", () => {
  it("sends the trimmed matrícula and course when the level is student", () => {
    assert.deepEqual(buildRegisterData(estudante, true), {
      ok: true,
      data: {
        full_name: "Maria Souza",
        email: "maria.souza@escola.br",
        cpf: "11144477735",
        id_level: 2,
        enrollment_number: "20261TADS0012",
        course: "Análise e Desenvolvimento de Sistemas",
      },
    });
  });

  it("does not send matrícula and course for the other levels, even with the fields still filled", () => {
    const result = buildRegisterData(
      { ...estudante, id_level: "3" },
      true,
    );

    assert.deepEqual(result, {
      ok: true,
      data: {
        full_name: "Maria Souza",
        email: "maria.souza@escola.br",
        cpf: "11144477735",
        id_level: 3,
      },
    });
  });

  it("refuses a student without matrícula, empty or blank", () => {
    for (const matricula of ["", "   "]) {
      assert.deepEqual(buildRegisterData({ ...estudante, matricula }, true), {
        ok: false,
        error: "Informe a matrícula do estudante.",
      });
    }
  });

  it("refuses a student without course, empty or blank", () => {
    for (const curso of ["", "   "]) {
      assert.deepEqual(buildRegisterData({ ...estudante, curso }, true), {
        ok: false,
        error: "Informe o curso do estudante.",
      });
    }
  });

  it("does not require them for the other levels", () => {
    assert.equal(buildRegisterData({ ...form, id_level: "1" }, true).ok, true);
  });

  it("keeps the consent and the cpf checks ahead of the student fields", () => {
    assert.deepEqual(
      buildRegisterData({ ...estudante, matricula: "", curso: "" }, false),
      { ok: false, error: "É necessário aceitar o Termo de Consentimento." },
    );
    assert.deepEqual(
      buildRegisterData({ ...estudante, cpf: "111", matricula: "" }, true),
      { ok: false, error: "O CPF deve ter 11 dígitos." },
    );
  });
});

// O back aplica ^[A-Z0-9./-]+$ (ENROLLMENT_NUMBER_PATTERN) depois de aparar e
// passar para caixa alta, e recusa mais de 30 caracteres. O front confere o
// mesmo, para o erro aparecer em português antes de a requisição sair.
describe("buildRegisterData, formato da matrícula", () => {
  const MENSAGEM_FORMATO =
    "A matrícula aceita só letras sem acento, números, ponto, hífen e barra.";

  it("accepts the characters the back accepts", () => {
    for (const matricula of [
      "20261TADS0012",
      "2026.1-AB/01",
      "A",
      ".",
      "-",
      "/",
      "A".repeat(30),
    ]) {
      const result = buildRegisterData({ ...estudante, matricula }, true);

      assert.equal(result.ok, true, matricula);
    }
  });

  it("accepts lower case and surrounding spaces, as the back normalizes them", () => {
    for (const matricula of ["ads-01", "  ads-01  ", " 2026.1-ab/01"]) {
      const result = buildRegisterData({ ...estudante, matricula }, true);

      assert.equal(result.ok, true, matricula);
    }
  });

  it("refuses characters outside letters, digits, dot, hyphen and slash", () => {
    for (const matricula of [
      "AB 12",
      "AB_12",
      "AB@12",
      "AB#12",
      "AB\\12",
      "AB';--",
      "<b>1</b>",
      "MATRÍCULA1",
      "ÀB12",
      "ÇA12",
      "２０２６",
      "AB\n12",
    ]) {
      assert.deepEqual(
        buildRegisterData({ ...estudante, matricula }, true),
        { ok: false, error: MENSAGEM_FORMATO },
        matricula,
      );
    }
  });

  it("refuses more than 30 characters after trimming", () => {
    assert.deepEqual(
      buildRegisterData({ ...estudante, matricula: "A".repeat(31) }, true),
      { ok: false, error: "A matrícula deve ter no máximo 30 caracteres." },
    );
    assert.equal(
      buildRegisterData(
        { ...estudante, matricula: ` ${"A".repeat(30)} ` },
        true,
      ).ok,
      true,
    );
  });

  it("asks for the matrícula before judging its format", () => {
    assert.deepEqual(
      buildRegisterData({ ...estudante, matricula: "  " }, true),
      { ok: false, error: "Informe a matrícula do estudante." },
    );
  });

  it("does not judge the format for the other levels, where the field is not sent", () => {
    const result = buildRegisterData(
      { ...estudante, id_level: "3", matricula: "AB 12" },
      true,
    );

    assert.equal(result.ok, true);
  });
});

// Mesma compilação que o navegador aplica ao atributo pattern: com a flag v, o
// hífen e a barra dentro de uma classe precisam de escape, ou a expressão é
// inválida e o navegador ignora a validação.
describe("MATRICULA_PATTERN", () => {
  const compileAsBrowser = () =>
    new RegExp(`^(?:${MATRICULA_PATTERN})$`, "v");

  it("compiles with the v flag used by the browser", () => {
    assert.doesNotThrow(compileAsBrowser);
  });

  it("accepts what the back accepts, in either case, and surrounding spaces", () => {
    const regex = compileAsBrowser();

    for (const value of [
      "20261TADS0012",
      "2026.1-ab/01",
      " ads-01 ",
      "A".repeat(30),
    ]) {
      assert.equal(regex.test(value), true, value);
    }
  });

  it("refuses what the back refuses", () => {
    const regex = compileAsBrowser();

    for (const value of [
      "",
      " ",
      "AB 12",
      "AB_12",
      "AB@12",
      "MATRÍCULA1",
      "AB';--",
    ]) {
      assert.equal(regex.test(value), false, value);
    }
  });
});

describe("cadastraEstudante", () => {
  it("is true only for the student level", () => {
    assert.equal(cadastraEstudante("2"), true);

    for (const nivel of ["1", "3", "4", "5", ""]) {
      assert.equal(cadastraEstudante(nivel), false);
    }
  });
});
