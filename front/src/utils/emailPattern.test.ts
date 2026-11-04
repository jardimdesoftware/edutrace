import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { EMAIL_PATTERN, removerEspacos } from "./emailPattern";

describe("removerEspacos", () => {
  it("removes spaces typed or pasted anywhere in the value", () => {
    assert.equal(removerEspacos(" maria @escola.br "), "maria@escola.br");
    assert.equal(removerEspacos("ma ria.souza@es cola.br"), "maria.souza@escola.br");
  });

  it("removes tabs, line breaks and non-breaking spaces too", () => {
    assert.equal(removerEspacos("maria\t@escola.br\n"), "maria@escola.br");
    assert.equal(removerEspacos("maria @escola.br"), "maria@escola.br");
  });

  it("leaves a value without spaces untouched", () => {
    assert.equal(removerEspacos("maria.souza@escola.br"), "maria.souza@escola.br");
    assert.equal(removerEspacos(""), "");
  });
});

// Mesma compilação que o navegador aplica ao atributo pattern.
function compileAsBrowser(pattern: string) {
  return new RegExp(`^(?:${pattern})$`, "v");
}

describe("EMAIL_PATTERN", () => {
  it("compiles with the v flag used by the browser", () => {
    assert.doesNotThrow(() => compileAsBrowser(EMAIL_PATTERN));
  });

  it("accepts the e-mail formats used in the system", () => {
    const regex = compileAsBrowser(EMAIL_PATTERN);

    for (const email of [
      "maria.souza@escola.br",
      "aluno+turma@discente.ifpe.edu.br",
      "joao_1%2@sub-dominio.com.br",
      "Maria.Souza@Escola.Br",
    ]) {
      assert.equal(regex.test(email), true, email);
    }
  });

  it("refuses text that is not an e-mail", () => {
    const regex = compileAsBrowser(EMAIL_PATTERN);

    for (const value of ["sem-arroba.com", "usuario@dominio", "@escola.br", "usuario@.br"]) {
      assert.equal(regex.test(value), false, value);
    }
  });
});
