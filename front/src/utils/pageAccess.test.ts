import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { canAccessPage } from "./pageAccess";
import {
  ADMIN,
  ESTUDANTE,
  PROFISSIONAL_EDUCACAO,
  PROFISSIONAL_SAUDE,
} from "../consts";

const TODOS = [ADMIN, ESTUDANTE, PROFISSIONAL_EDUCACAO, PROFISSIONAL_SAUDE];
const NIVEL_CRIADO_PELO_ADMIN = 7;

// Página e níveis que podem abri-la, na regra atual de perfis.
const MATRIZ: [string, number[]][] = [
  ["/triagem", TODOS],
  ["/anamnese", TODOS],
  ["/pei", TODOS],
  ["/comentarios", TODOS],
  ["/estudantes/visualizar", [ADMIN, PROFISSIONAL_EDUCACAO, PROFISSIONAL_SAUDE]],
  ["/editar-triagem", [ADMIN, PROFISSIONAL_SAUDE]],
  ["/editar-anamnese", [ADMIN, PROFISSIONAL_SAUDE]],
  ["/editar-pei", [ADMIN, PROFISSIONAL_EDUCACAO]],
  ["/admin/usuarios/cadastro", [ADMIN]],
];

describe("canAccessPage", () => {
  for (const [pagina, permitidos] of MATRIZ) {
    for (const nivel of TODOS) {
      const esperado = permitidos.includes(nivel);
      it(`${esperado ? "opens" : "denies"} ${pagina} to level ${nivel}`, () => {
        assert.equal(canAccessPage(pagina, nivel), esperado);
      });
    }
  }

  it("opens the pages of the session account to any level, including one created by the administrator", () => {
    for (const pagina of ["/home", "/alterar-dados", "/completar-cadastro"]) {
      for (const nivel of [...TODOS, NIVEL_CRIADO_PELO_ADMIN]) {
        assert.equal(canAccessPage(pagina, nivel), true, `${pagina} ${nivel}`);
      }
    }
  });

  it("denies the student pages to a level created by the administrator", () => {
    assert.equal(canAccessPage("/triagem", NIVEL_CRIADO_PELO_ADMIN), false);
  });

  it("denies a page that is not in the list to every level", () => {
    for (const nivel of TODOS) {
      assert.equal(canAccessPage("/pagina-nova", nivel), false);
    }
  });

  it("matches a listed page and its subpaths, but not another page with the same prefix", () => {
    assert.equal(canAccessPage("/admin", ADMIN), true);
    assert.equal(canAccessPage("/admin/usuarios", ADMIN), true);
    assert.equal(canAccessPage("/administracao", ADMIN), false);
    assert.equal(canAccessPage("/pei-antigo", ADMIN), false);
  });

  it("denies the student view to a student, whose old rule checked a prefix that never matched", () => {
    assert.equal(canAccessPage("/estudantes/visualizar", ESTUDANTE), false);
  });
});

// O middleware nega a página fora do mapa. Sem esta varredura, a página nova
// sem entrada no mapa só apareceria como redirecionamento para a home.
const APP_DIR = fileURLToPath(new URL("../app/", import.meta.url));
const PAGINAS_PUBLICAS = ["/", "/login", "/forgot-password", "/definir-senha"];

function rotasDasPaginas(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entrada) => {
    const caminho = join(dir, entrada.name);
    if (entrada.isDirectory()) return rotasDasPaginas(caminho);
    if (!/^page\.(tsx|ts|jsx|js)$/.test(entrada.name)) return [];
    const segmentos = relative(APP_DIR, dir)
      .split(sep)
      .filter((segmento) => segmento && !/^\(.*\)$/.test(segmento));
    return [`/${segmentos.join("/")}`];
  });
}

describe("pages of the app", () => {
  const rotas = rotasDasPaginas(APP_DIR);

  it("finds the pages of every route group", () => {
    assert.ok(rotas.includes("/home"), rotas.join(", "));
    assert.ok(rotas.includes("/estudantes/visualizar"), rotas.join(", "));
  });

  for (const rota of rotas) {
    it(`lists ${rota} as public or in the allowlist`, () => {
      const liberada =
        PAGINAS_PUBLICAS.includes(rota) ||
        TODOS.some((nivel) => canAccessPage(rota, nivel));
      assert.ok(liberada);
    });
  }
});
