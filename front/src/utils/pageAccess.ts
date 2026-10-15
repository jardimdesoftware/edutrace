import {
  ADMIN,
  ESTUDANTE,
  PROFISSIONAL_EDUCACAO,
  PROFISSIONAL_SAUDE,
} from "@/consts";

const ANY_LEVEL = "any";
const TODOS = [ADMIN, ESTUDANTE, PROFISSIONAL_EDUCACAO, PROFISSIONAL_SAUDE];

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
  "/estudantes/visualizar": [ADMIN, PROFISSIONAL_EDUCACAO, PROFISSIONAL_SAUDE],
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
