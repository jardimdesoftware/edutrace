import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const SRC_DIR = fileURLToPath(new URL("../", import.meta.url));
const NOME_DIVERGENTE = "Plano de Ensino Individualizado";

function arquivosTsx(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entrada) => {
    const caminho = join(dir, entrada.name);
    if (entrada.isDirectory()) return arquivosTsx(caminho);
    return entrada.name.endsWith(".tsx") ? [caminho] : [];
  });
}

describe("nome do PEI no front", () => {
  it("nenhuma tela chama o PEI de Plano de Ensino Individualizado", () => {
    const divergentes = arquivosTsx(SRC_DIR)
      .filter((arquivo) => readFileSync(arquivo, "utf8").includes(NOME_DIVERGENTE))
      .map((arquivo) => relative(SRC_DIR, arquivo));

    assert.deepEqual(divergentes, []);
  });
});
