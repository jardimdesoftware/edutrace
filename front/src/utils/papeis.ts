import {
  ADMIN,
  ESTUDANTE,
  PROFESSOR_AEE,
  PROFISSIONAL_EDUCACAO,
  PROFISSIONAL_NAPNE,
  PROFISSIONAL_SAUDE,
} from "@/consts";

export type Papeis = readonly number[] | null | undefined;

// O que as regras de tela leem da sessão: quem é (sub) e os papéis que tem.
export type UsuarioLogado = { sub: number; roles: readonly number[] };

// Rótulo de cada papel, no mapa único que Navbar, tabela de usuários, ficha do
// estudante, cadastro e opções de responsável usam.
export const ROTULO_DO_PAPEL: Readonly<Record<number, string>> = {
  [ADMIN]: "Administrador",
  [ESTUDANTE]: "Estudante/Família",
  [PROFISSIONAL_EDUCACAO]: "Profissional da Educação",
  [PROFISSIONAL_SAUDE]: "Profissional da Saúde",
  [PROFISSIONAL_NAPNE]: "Profissional NAPNE",
  [PROFESSOR_AEE]: "Professor(a) do AEE",
};

export const PAPEL_DESCONHECIDO = "Papel desconhecido";

// Admin e Estudante/Família não combinam com nenhum outro papel; os
// profissionais combinam livremente entre si.
const PAPEIS_EXCLUSIVOS: readonly number[] = [ADMIN, ESTUDANTE];
const IDS_DOS_PAPEIS = Object.keys(ROTULO_DO_PAPEL).map(Number);

export const PAPEIS_DO_FORMULARIO: readonly number[] = IDS_DOS_PAPEIS;

// Usuário com vários papéis tem a união das permissões: basta um deles estar
// entre os pedidos.
export function temPapel(roles: Papeis, ...papeis: number[]): boolean {
  return !!roles && papeis.some((papel) => roles.includes(papel));
}

export function rotulosDosPapeis(roles: Papeis): string[] {
  return [...(roles ?? [])]
    .sort((a, b) => a - b)
    .map((papel) => ROTULO_DO_PAPEL[papel] ?? PAPEL_DESCONHECIDO);
}

// Marcar Admin ou Estudante desmarca os demais; marcar um profissional
// desmarca Admin e Estudante. Desmarcar só tira o papel. A lista sai em ordem
// crescente e sem repetição, como o back a guarda.
export function alternarPapel(
  atuais: readonly number[],
  papel: number,
  marcado: boolean,
): number[] {
  if (!marcado) return atuais.filter((atual) => atual !== papel);
  if (PAPEIS_EXCLUSIVOS.includes(papel)) return [papel];

  const profissionais = atuais.filter((atual) => !PAPEIS_EXCLUSIVOS.includes(atual));
  return [...new Set([...profissionais, papel])].sort((a, b) => a - b);
}

// Mesmas regras do DTO e do CHECK do back, para a mensagem sair antes do envio.
export function erroDosPapeis(roles: readonly number[]): string | null {
  if (roles.length === 0) return "Selecione ao menos um papel.";
  if (new Set(roles).size !== roles.length) return "Há papel repetido na seleção.";
  if (roles.some((papel) => !IDS_DOS_PAPEIS.includes(papel))) {
    return "Há papel desconhecido na seleção.";
  }
  if (roles.length > 1 && roles.some((papel) => PAPEIS_EXCLUSIVOS.includes(papel))) {
    return "Administrador e Estudante/Família não combinam com outros papéis.";
  }
  return null;
}

export type EstadoDoRascunhoDePapeis = {
  alterado: boolean;
  erro: string | null;
  podeSalvar: boolean;
};

// Rascunho de papéis de uma linha da tabela: só difere do gravado se o
// conjunto mudou (a ordem não conta), e só pode ser salvo se a composição for
// válida. Lista vazia é erro, para o desmarcar do único papel ter aviso.
export function estadoDoRascunhoDePapeis(
  gravado: readonly number[],
  rascunho: readonly number[],
): EstadoDoRascunhoDePapeis {
  const alterado =
    gravado.length !== rascunho.length || rascunho.some((papel) => !gravado.includes(papel));
  const erro = erroDosPapeis(rascunho);
  return { alterado, erro, podeSalvar: alterado && erro === null };
}
