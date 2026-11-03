import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { NIVEIS_PROFISSIONAIS, canAccessPage, conteudoDaHome } from "./pageAccess";
import {
  ADMIN,
  ESTUDANTE,
  PROFESSOR_AEE,
  PROFISSIONAL_EDUCACAO,
  PROFISSIONAL_NAPNE,
  PROFISSIONAL_SAUDE,
} from "../consts";

const TODOS = [
  ADMIN,
  ESTUDANTE,
  PROFISSIONAL_EDUCACAO,
  PROFISSIONAL_SAUDE,
  PROFISSIONAL_NAPNE,
  PROFESSOR_AEE,
];
const SEM_ADMIN = TODOS.filter((nivel) => nivel !== ADMIN);
const NIVEL_CRIADO_PELO_ADMIN = 7;

// Página e níveis que podem abri-la, na regra atual de perfis.
const MATRIZ: [string, number[]][] = [
  ["/triagem", SEM_ADMIN],
  ["/anamnese", [ESTUDANTE, PROFISSIONAL_NAPNE]],
  ["/pei", SEM_ADMIN],
  ["/comentarios", SEM_ADMIN],
  ["/estudo-de-caso", SEM_ADMIN],
  ["/paee", SEM_ADMIN],
  [
    "/estudantes/visualizar",
    [PROFISSIONAL_EDUCACAO, PROFISSIONAL_SAUDE, PROFISSIONAL_NAPNE, PROFESSOR_AEE],
  ],
  ["/editar-triagem", [PROFISSIONAL_SAUDE, PROFISSIONAL_NAPNE]],
  ["/editar-anamnese", [PROFISSIONAL_NAPNE]],
  ["/admin/usuarios/cadastro", [ADMIN, PROFISSIONAL_NAPNE]],
];

describe("canAccessPage", () => {
  for (const [pagina, permitidos] of MATRIZ) {
    for (const nivel of TODOS) {
      const esperado = permitidos.includes(nivel);
      it(`${esperado ? "opens" : "denies"} ${pagina} to level ${nivel}`, () => {
        assert.equal(canAccessPage(pagina, [nivel]), esperado);
      });
    }
  }

  it("opens the pages of the session account to any level, including one created by the administrator", () => {
    for (const pagina of ["/home", "/alterar-dados", "/completar-cadastro"]) {
      for (const nivel of [...TODOS, NIVEL_CRIADO_PELO_ADMIN]) {
        assert.equal(canAccessPage(pagina, [nivel]), true, `${pagina} ${nivel}`);
      }
    }
  });

  it("denies the student pages to a level created by the administrator", () => {
    assert.equal(canAccessPage("/triagem", [NIVEL_CRIADO_PELO_ADMIN]), false);
  });

  it("opens to the NAPNE professional only the registration page of /admin, as POST /users in the back", () => {
    for (const pagina of ["/admin", "/admin/usuarios", "/admin/outra-pagina"]) {
      assert.equal(canAccessPage(pagina, [PROFISSIONAL_NAPNE]), false, pagina);
      assert.equal(canAccessPage(pagina, [ADMIN]), true, pagina);
    }
  });

  it("denies a page that is not in the list to every level", () => {
    for (const nivel of TODOS) {
      assert.equal(canAccessPage("/pagina-nova", [nivel]), false);
    }
  });

  it("denies /editar-pei to every level, because the PEI is now edited on /pei", () => {
    for (const nivel of TODOS) {
      assert.equal(canAccessPage("/editar-pei", [nivel]), false, String(nivel));
    }
  });

  it("matches a listed page and its subpaths, but not another page with the same prefix", () => {
    assert.equal(canAccessPage("/admin", [ADMIN]), true);
    assert.equal(canAccessPage("/admin/usuarios", [ADMIN]), true);
    assert.equal(canAccessPage("/administracao", [ADMIN]), false);
    assert.equal(canAccessPage("/pei-antigo", [ADMIN]), false);
  });

  it("denies the student view to a student, whose old rule checked a prefix that never matched", () => {
    assert.equal(canAccessPage("/estudantes/visualizar", [ESTUDANTE]), false);
  });
});

describe("NIVEIS_PROFISSIONAIS", () => {
  it("lists the roles that serve students, as GET /students and POST /comments in the back", () => {
    assert.deepEqual([...NIVEIS_PROFISSIONAIS].sort(), [
      PROFISSIONAL_EDUCACAO,
      PROFISSIONAL_SAUDE,
      PROFISSIONAL_NAPNE,
      PROFESSOR_AEE,
    ]);
  });
});

describe("conteudoDaHome", () => {
  it("shows the student cards to the student", () => {
    assert.equal(conteudoDaHome([ESTUDANTE]), "estudante");
  });

  it("shows the student table to the levels that serve students", () => {
    for (const nivel of [
      PROFISSIONAL_EDUCACAO,
      PROFISSIONAL_SAUDE,
      PROFISSIONAL_NAPNE,
      PROFESSOR_AEE,
    ]) {
      assert.equal(conteudoDaHome([nivel]), "profissional", String(nivel));
    }
  });

  it("shows the user table, and no student data, to the administrator", () => {
    assert.equal(conteudoDaHome([ADMIN]), "administrador");
  });

  it("shows no table to a level created by the administrator, so the home calls no route it cannot access", () => {
    assert.equal(conteudoDaHome([NIVEL_CRIADO_PELO_ADMIN]), "sem-perfil");
  });
});

describe("canAccessPage with several roles", () => {
  it("opens a page when any of the roles opens it (union of permissions)", () => {
    // 3+6: Educação não abre a edição da triagem, o AEE também não; abrem leitura
    assert.equal(canAccessPage("/triagem", [PROFISSIONAL_EDUCACAO, PROFESSOR_AEE]), true);
    assert.equal(canAccessPage("/editar-triagem", [PROFISSIONAL_EDUCACAO, PROFESSOR_AEE]), false);
    // 5+6: NAPNE abre anamnese e edição de anamnese
    assert.equal(canAccessPage("/editar-anamnese", [PROFISSIONAL_NAPNE, PROFESSOR_AEE]), true);
    assert.equal(canAccessPage("/anamnese", [PROFISSIONAL_NAPNE, PROFESSOR_AEE]), true);
    assert.equal(canAccessPage("/admin/usuarios/cadastro", [PROFISSIONAL_NAPNE, PROFESSOR_AEE]), true);
    // 4+5: Saúde e NAPNE
    assert.equal(canAccessPage("/editar-triagem", [PROFISSIONAL_SAUDE, PROFISSIONAL_NAPNE]), true);
    assert.equal(canAccessPage("/admin", [PROFISSIONAL_SAUDE, PROFISSIONAL_NAPNE]), false);
  });

  it("opens a page by a role that is not the first of the list", () => {
    assert.equal(canAccessPage("/editar-triagem", [PROFISSIONAL_EDUCACAO, PROFISSIONAL_SAUDE]), true);
    assert.equal(canAccessPage("/editar-anamnese", [PROFISSIONAL_SAUDE, PROFISSIONAL_NAPNE]), true);
  });

  it("gives the AEE teacher alone the reads and none of the NAPNE pages", () => {
    for (const pagina of [
      "/triagem",
      "/pei",
      "/comentarios",
      "/estudo-de-caso",
      "/paee",
      "/estudantes/visualizar",
    ]) {
      assert.equal(canAccessPage(pagina, [PROFESSOR_AEE]), true, pagina);
    }
    for (const pagina of [
      "/anamnese",
      "/editar-anamnese",
      "/editar-triagem",
      "/admin",
      "/admin/usuarios/cadastro",
    ]) {
      assert.equal(canAccessPage(pagina, [PROFESSOR_AEE]), false, pagina);
    }
  });

  it("denies a session without roles every page except the ones open to any account", () => {
    assert.equal(canAccessPage("/triagem", []), false);
    assert.equal(canAccessPage("/triagem", undefined), false);
    assert.equal(canAccessPage("/home", []), true);
  });
});

describe("conteudoDaHome with several roles", () => {
  it("shows the student table to every professional combination, never the student cards", () => {
    for (const roles of [[3, 6], [5, 6], [4, 5], [3, 4, 5, 6]]) {
      assert.equal(conteudoDaHome(roles), "profissional", roles.join(","));
    }
  });

  it("shows no table to a session without roles", () => {
    assert.equal(conteudoDaHome([]), "sem-perfil");
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
        TODOS.some((nivel) => canAccessPage(rota, [nivel]));
      assert.ok(liberada);
    });
  }
});
