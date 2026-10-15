import {
  ADMIN,
  ESTUDANTE,
  PROFISSIONAL_EDUCACAO,
  PROFISSIONAL_SAUDE,
} from "@/consts";

const ANY_LEVEL = "any";
const TODOS = [ADMIN, ESTUDANTE, PROFISSIONAL_EDUCACAO, PROFISSIONAL_SAUDE];

// Níveis que atendem estudantes: listam e visualizam qualquer estudante e
// escrevem anotações, como GET /students e POST /comments no back.
export const NIVEIS_PROFISSIONAIS: readonly number[] = [
  ADMIN,
  PROFISSIONAL_EDUCACAO,
  PROFISSIONAL_SAUDE,
];

// Níveis que podem abrir cada página autenticada, com as mesmas regras do
// @AllowLevels das rotas do back que a página chama. Página fora desta lista é
// negada a qualquer nível. Quem protege os dados é o back; esta lista evita
// renderizar a tela cujas ações o back recusaria.
const PAGE_LEVELS: Record<string, readonly number[] | typeof ANY_LEVEL> = {
  "/home": ANY_LEVEL,
  "/alterar-dados": ANY_LEVEL,
  "/completar-cadastro": ANY_LEVEL,
  "/triagem": TODOS,
  "/anamnese": TODOS,
  "/pei": TODOS,
  "/comentarios": TODOS,
  "/estudantes/visualizar": NIVEIS_PROFISSIONAIS,
  "/editar-triagem": [ADMIN, PROFISSIONAL_SAUDE],
  "/editar-anamnese": [ADMIN, PROFISSIONAL_SAUDE],
  "/editar-pei": [ADMIN, PROFISSIONAL_EDUCACAO],
  "/admin": [ADMIN],
};

export function canAccessPage(pathname: string, idLevel: number): boolean {
  const page = Object.keys(PAGE_LEVELS).find(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
  if (!page) return false;

  const levels = PAGE_LEVELS[page];
  return levels === ANY_LEVEL || levels.includes(idLevel);
}

export type ConteudoDaHome = "estudante" | "profissional" | "sem-perfil";

// A home abre para qualquer nível, porque é o destino dos redirecionamentos.
// O nível sem perfil de atendimento não recebe a tabela de estudantes, que
// chamaria uma rota do back que ele não acessa.
export function conteudoDaHome(idLevel: number): ConteudoDaHome {
  if (idLevel === ESTUDANTE) return "estudante";
  return NIVEIS_PROFISSIONAIS.includes(idLevel) ? "profissional" : "sem-perfil";
}
