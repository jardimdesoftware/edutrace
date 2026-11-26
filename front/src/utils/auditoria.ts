export type AcaoDaAuditoria = "CREATE" | "UPDATE" | "DELETE" | "DOWNLOAD" | "VIEW_LOG";

export type RegistroDaAuditoria = {
  id: number;
  created_at: string;
  action: AcaoDaAuditoria;
  entity: string;
  entity_id: number | null;
  changes: Record<string, { from: unknown; to: unknown }> | null;
  detail: Record<string, unknown> | null;
  succeeded: boolean;
  actor_id: number | null;
  actor_name: string | null;
  actor_email: string | null;
  method: string | null;
  route: string | null;
  ip: string | null;
};

export type PaginaDaAuditoria = {
  items: RegistroDaAuditoria[];
  total: number;
  page: number;
  pageSize: number;
};

export type FiltrosDaAuditoria = {
  search?: string;
  action?: AcaoDaAuditoria | "";
  entity?: string;
  // Datas do <input type="date">, no fuso de quem consulta.
  from?: string;
  to?: string;
  page?: number;
};

export const ACOES: Record<AcaoDaAuditoria, string> = {
  CREATE: "Criou",
  UPDATE: "Alterou",
  DELETE: "Excluiu",
  DOWNLOAD: "Baixou PDF",
  VIEW_LOG: "Consultou o log",
};

export const ENTIDADES: Record<string, string> = {
  User: "Usuário",
  Screening: "Triagem",
  Anamnesis: "Anamnese",
  CaseStudy: "Estudo de caso",
  AeePlan: "PAEE",
  PeiEntry: "PEI",
  FormRevision: "Versão de formulário",
  Comments: "Anotação",
  CommentEdits: "Edição de anotação",
  AeeReferral: "Encaminhamento ao AEE",
  AeeAppointment: "Horário da agenda",
  StudentReport: "Relatório do estudante",
  AeeAgenda: "Agenda do AEE",
  AuditLog: "Log de auditoria",
};

export function rotuloDaEntidade(entity: string): string {
  return ENTIDADES[entity] ?? entity;
}

// O dia escolhido vale inteiro: "de" começa às 00:00 e "até" termina às
// 23:59:59.999 do fuso local, enviados em UTC.
function inicioDoDia(data: string): string {
  return new Date(`${data}T00:00:00`).toISOString();
}

function fimDoDia(data: string): string {
  return new Date(`${data}T23:59:59.999`).toISOString();
}

export function consultaDaAuditoria(filtros: FiltrosDaAuditoria): string {
  const params = new URLSearchParams();
  const busca = filtros.search?.trim();
  if (busca) params.set("search", busca);
  if (filtros.action) params.set("action", filtros.action);
  if (filtros.entity) params.set("entity", filtros.entity);
  if (filtros.from) params.set("from", inicioDoDia(filtros.from));
  if (filtros.to) params.set("to", fimDoDia(filtros.to));
  if (filtros.page && filtros.page > 1) params.set("page", String(filtros.page));

  const texto = params.toString();
  return texto ? `?${texto}` : "";
}

const DATA_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

export function formatarValor(valor: unknown): string {
  if (valor === null || valor === undefined) return "(vazio)";
  if (typeof valor === "string") {
    return DATA_ISO.test(valor) ? new Date(valor).toLocaleString("pt-BR") : valor;
  }
  return JSON.stringify(valor);
}

export type LinhaDeMudanca = { campo: string; de: string; para: string };

export function linhasDasMudancas(
  changes: RegistroDaAuditoria["changes"],
): LinhaDeMudanca[] {
  return Object.entries(changes ?? {}).map(([campo, { from, to }]) => ({
    campo,
    de: formatarValor(from),
    para: formatarValor(to),
  }));
}

export type ExportacaoDaAuditoria = { items: RegistroDaAuditoria[]; truncated: boolean };

// OWASP CSV Injection: toda célula vai entre aspas, com as aspas internas
// dobradas, e a que começa com caractere de fórmula recebe um apóstrofo antes.
const INICIO_DE_FORMULA = /^[=+\-@\t\r\n＝＋－＠]/;

function celula(valor: unknown): string {
  const texto = valor === null || valor === undefined
    ? ""
    : typeof valor === "string" ? valor : JSON.stringify(valor);
  const seguro = INICIO_DE_FORMULA.test(texto) ? `'${texto}` : texto;
  return `"${seguro.replace(/"/g, '""')}"`;
}

const COLUNAS_DO_CSV: [string, (r: RegistroDaAuditoria) => unknown][] = [
  ["id", (r) => r.id],
  ["quando", (r) => r.created_at],
  ["acao", (r) => ACOES[r.action] ?? r.action],
  ["registro", (r) => rotuloDaEntidade(r.entity)],
  ["registro_id", (r) => r.entity_id],
  ["requisicao_concluida", (r) => (r.succeeded ? "sim" : "não")],
  ["quem_id", (r) => r.actor_id],
  ["quem_nome", (r) => r.actor_name],
  ["quem_email", (r) => r.actor_email],
  ["metodo", (r) => r.method],
  ["rota", (r) => r.route],
  ["ip", (r) => r.ip],
  ["mudancas", (r) => r.changes],
  ["detalhe", (r) => r.detail],
];

// Separado por ponto e vírgula e com BOM, para o Excel em pt-BR abrir as
// colunas e os acentos certos.
export function csvDaAuditoria(registros: RegistroDaAuditoria[]): string {
  const linhas = [
    COLUNAS_DO_CSV.map(([nome]) => celula(nome)),
    ...registros.map((r) => COLUNAS_DO_CSV.map(([, valor]) => celula(valor(r)))),
  ];
  return `﻿${linhas.map((linha) => linha.join(";")).join("\r\n")}\r\n`;
}

export function totalDePaginas(pagina: Pick<PaginaDaAuditoria, "total" | "pageSize">): number {
  return Math.max(1, Math.ceil(pagina.total / pagina.pageSize));
}
