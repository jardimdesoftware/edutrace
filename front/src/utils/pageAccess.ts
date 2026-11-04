import {
  ADMIN,
  ESTUDANTE,
  PROFESSOR_AEE,
  PROFISSIONAL_EDUCACAO,
  PROFISSIONAL_NAPNE,
  PROFISSIONAL_SAUDE,
} from "@/consts";
import { temPapel, type Papeis } from "./papeis";

const ANY_LEVEL = "any";
// O administrador só gerencia usuários: fica fora das telas de estudante, como
// as rotas correspondentes do back.
const TODOS_MENOS_ADMIN = [
  ESTUDANTE,
  PROFISSIONAL_EDUCACAO,
  PROFISSIONAL_SAUDE,
  PROFISSIONAL_NAPNE,
  PROFESSOR_AEE,
];

// Papéis que atendem estudantes: listam e visualizam qualquer estudante e
// escrevem anotações, como GET /students e POST /comments no back.
export const NIVEIS_PROFISSIONAIS: readonly number[] = [
  PROFISSIONAL_EDUCACAO,
  PROFISSIONAL_SAUDE,
  PROFISSIONAL_NAPNE,
  PROFESSOR_AEE,
];

// Papéis que podem abrir cada página autenticada, com as mesmas regras do
// @AllowLevels das rotas do back que a página chama. Página fora desta lista é
// negada a qualquer papel. Quem protege os dados é o back; esta lista evita
// renderizar a tela cujas ações o back recusaria.
const PAGE_LEVELS: Record<string, readonly number[] | typeof ANY_LEVEL> = {
  "/visual-preview": ANY_LEVEL,
  "/home": ANY_LEVEL,
  "/alterar-dados": ANY_LEVEL,
  "/completar-cadastro": ANY_LEVEL,
  "/triagem": TODOS_MENOS_ADMIN,
  "/anamnese": [ESTUDANTE, PROFISSIONAL_NAPNE],
  "/pei": TODOS_MENOS_ADMIN,
  "/comentarios": TODOS_MENOS_ADMIN,
  "/estudo-de-caso": TODOS_MENOS_ADMIN,
  "/paee": TODOS_MENOS_ADMIN,
  "/estudantes/visualizar": NIVEIS_PROFISSIONAIS,
  "/editar-triagem": [PROFISSIONAL_SAUDE, PROFISSIONAL_NAPNE],
  "/editar-anamnese": [PROFISSIONAL_NAPNE],
  // Vem antes de "/admin": canAccessPage usa a primeira rota cujo prefixo casa.
  "/admin/usuarios/cadastro": [ADMIN, PROFISSIONAL_NAPNE],
  "/admin": [ADMIN],
};

// A página abre se algum dos papéis do usuário está na lista dela.
export function canAccessPage(pathname: string, roles: Papeis): boolean {
  const page = Object.keys(PAGE_LEVELS).find(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
  if (!page) return false;

  const levels = PAGE_LEVELS[page];
  return levels === ANY_LEVEL || temPapel(roles, ...levels);
}

export type ConteudoDaHome =
  | "estudante"
  | "profissional"
  | "administrador"
  | "sem-perfil";

// A home abre para qualquer papel, porque é o destino dos redirecionamentos.
// Quem não tem perfil de atendimento não recebe a tabela de estudantes, que
// chamaria uma rota do back que ele não acessa. Estudante/Família não combina
// com outro papel, então a ordem dos testes não tira um profissional do ramo
// dele.
export function conteudoDaHome(roles: Papeis): ConteudoDaHome {
  if (temPapel(roles, ESTUDANTE)) return "estudante";
  if (temPapel(roles, ADMIN)) return "administrador";
  return temPapel(roles, ...NIVEIS_PROFISSIONAIS) ? "profissional" : "sem-perfil";
}
