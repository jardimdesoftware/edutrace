import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildCompleteRegistration } from "./completeRegistrationForm";
import { CURSOS } from "./cursos";

const form = {
  cpf: "012.345.678-90",
  matricula: "20261TADS0012",
  curso: "Integrado: Informática",
  senha: "senhaNovaSegura1",
  confirmarSenha: "senhaNovaSegura1",
};

describe("buildCompleteRegistration", () => {
  it("sends the CPF digits, the password, the enrollment number and the course", () => {
    assert.deepEqual(buildCompleteRegistration(form), {
      ok: true,
      data: {
        cpf: "01234567890",
        password: "senhaNovaSegura1",
        enrollment_number: "20261TADS0012",
        course: "Integrado: Informática",
      },
    });
  });

  it("refuses a CPF without eleven digits", () => {
    assert.deepEqual(buildCompleteRegistration({ ...form, cpf: "012.345.678" }), {
      ok: false,
      error: "O CPF deve ter 11 dígitos.",
    });
  });

  it("refuses a password shorter than eight characters", () => {
    assert.deepEqual(
      buildCompleteRegistration({ ...form, senha: "curta12", confirmarSenha: "curta12" }),
      { ok: false, error: "A senha deve ter no mínimo 8 caracteres." },
    );
  });

  it("refuses when the confirmation is different", () => {
    assert.deepEqual(
      buildCompleteRegistration({ ...form, confirmarSenha: "outraSenha1" }),
      { ok: false, error: "As senhas não coincidem." },
    );
  });

  it("trims the enrollment number and sends it in upper case", () => {
    const resultado = buildCompleteRegistration({ ...form, matricula: "  20261tads.01 " });

    assert.equal(resultado.ok && resultado.data.enrollment_number, "20261TADS.01");
  });

  it("refuses an empty enrollment number", () => {
    assert.deepEqual(buildCompleteRegistration({ ...form, matricula: "   " }), {
      ok: false,
      error: "Informe a matrícula do estudante.",
    });
  });

  it("refuses an enrollment number with characters outside the pattern", () => {
    const resultado = buildCompleteRegistration({ ...form, matricula: "2026 01;" });

    assert.equal(resultado.ok, false);
  });

  it("refuses an enrollment number longer than thirty characters", () => {
    const resultado = buildCompleteRegistration({ ...form, matricula: "A".repeat(31) });

    assert.equal(resultado.ok, false);
  });

  it("refuses when no course was chosen", () => {
    assert.deepEqual(buildCompleteRegistration({ ...form, curso: "" }), {
      ok: false,
      error: "Selecione o seu curso na lista.",
    });
  });

  it("refuses a course that is not in the list", () => {
    assert.deepEqual(buildCompleteRegistration({ ...form, curso: "Informática" }), {
      ok: false,
      error: "Selecione o seu curso na lista.",
    });
  });

  it("accepts every course of the list", () => {
    for (const curso of CURSOS) {
      const resultado = buildCompleteRegistration({ ...form, curso });

      assert.equal(resultado.ok && resultado.data.course, curso);
    }
  });
});
