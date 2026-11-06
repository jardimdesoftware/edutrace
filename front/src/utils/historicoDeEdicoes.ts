import {
  PROFESSOR_AEE,
  PROFISSIONAL_EDUCACAO,
  PROFISSIONAL_NAPNE,
  PROFISSIONAL_SAUDE,
} from "@/consts";
import { temPapel, type Papeis } from "./papeis";

export type TipoDeFormulario = "SCREENING" | "ANAMNESIS" | "CASE_STUDY" | "AEE_PLAN";

export interface VersaoResumida {
  version: number;
  author_name: string;
  created_at: string;
}

export interface VersaoCompleta<T = unknown> extends VersaoResumida {
  snapshot: T;
}

// Mesmo teto do back (FORM_MAX_VERSIONS): a criação é a versão 1.
export const MAXIMO_DE_VERSOES = 5;

const LEITORES_DO_HISTORICO: Record<TipoDeFormulario, readonly number[]> = {
  SCREENING: [PROFISSIONAL_EDUCACAO, PROFISSIONAL_SAUDE, PROFISSIONAL_NAPNE, PROFESSOR_AEE],
  ANAMNESIS: [PROFISSIONAL_SAUDE, PROFISSIONAL_NAPNE, PROFESSOR_AEE],
  CASE_STUDY: [PROFISSIONAL_EDUCACAO, PROFISSIONAL_SAUDE, PROFISSIONAL_NAPNE, PROFESSOR_AEE],
  AEE_PLAN: [PROFISSIONAL_EDUCACAO, PROFISSIONAL_SAUDE, PROFISSIONAL_NAPNE, PROFESSOR_AEE],
};

// Os mesmos níveis que o back aceita em /form-revisions. O estudante lê o próprio
// formulário, mas não vê quem o editou. A checagem do back é a que vale.
export function podeVerHistorico(tipo: TipoDeFormulario, roles: Papeis): boolean {
  return temPapel(roles, ...LEITORES_DO_HISTORICO[tipo]);
}

export function ordenarDaMaisRecente<T extends VersaoResumida>(versoes: readonly T[]): T[] {
  return [...versoes].sort((a, b) => b.version - a.version);
}

export function limiteDeVersoesAtingido(versoes: readonly VersaoResumida[]): boolean {
  return versoes.length >= MAXIMO_DE_VERSOES;
}

export function formatarDataEHora(iso: string): string {
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return "data desconhecida";

  return data.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Recife",
  });
}

export interface ResumoDeAutoria {
  criadoPor: string;
  criadoEm: string;
  editadoPor: string | null;
  editadoEm: string | null;
}

// A versão 1 é a criação, e a de maior número é a última edição. Sem versões o
// formulário não tem histórico, e a tela não mostra autoria.
export function resumoDeAutoria(versoes: readonly VersaoResumida[]): ResumoDeAutoria | null {
  if (versoes.length === 0) return null;

  const ordenadas = [...versoes].sort((a, b) => a.version - b.version);
  const primeira = ordenadas[0];
  const ultima = ordenadas[ordenadas.length - 1];
  const foiEditado = ordenadas.length > 1;

  return {
    criadoPor: primeira.author_name,
    criadoEm: formatarDataEHora(primeira.created_at),
    editadoPor: foiEditado ? ultima.author_name : null,
    editadoEm: foiEditado ? formatarDataEHora(ultima.created_at) : null,
  };
}

export const MENSAGEM_DE_LIMITE =
  "Este formulário atingiu o limite de 5 versões e não aceita novas edições.";
