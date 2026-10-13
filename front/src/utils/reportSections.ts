import type { ReportsData } from '@/interfaces/ReportsData';
import { REPORT_SECTIONS, type ReportFieldDef } from './reportLabels';

export interface ReportRow {
  label: string;
  value: string;
}

// rows é null quando o estudante ainda não tem aquela ficha.
export interface ReportSection {
  title: string;
  rows: ReportRow[] | null;
}

const NAO_INFORMADO = 'Não informado';
const CHAVES_OUTRO = ['outro', 'outros'];

export function relatorioVazio(report: ReportsData): boolean {
  return !report.screening && !report.plansEducation;
}

// Mesmo texto que a tela do PEI exibe nas opções geradas a partir da chave.
function humanizarChave(key: string): string {
  return key.replaceAll('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase());
}

// Grupo de checkboxes: só as opções marcadas, uma por linha, mais o "Outro"
// quando preenchido. O jsonb do Postgres não guarda a ordem das chaves, então a
// ordem vem do formulário e o "Outro" fica por último.
function formatarGrupo(grupo: Record<string, unknown>, options: Record<string, string> = {}): string {
  const doFormulario = Object.keys(options).filter((key) => key in grupo);
  const restantes = Object.keys(grupo).filter(
    (key) => !(key in options) && !CHAVES_OUTRO.includes(key),
  );
  const outros = CHAVES_OUTRO.filter((key) => key in grupo);

  const linhas = [...doFormulario, ...restantes, ...outros].flatMap((key) => {
    const value = grupo[key];
    if (value === true) return [options[key] ?? humanizarChave(key)];
    if (CHAVES_OUTRO.includes(key) && typeof value === 'string' && value.trim()) {
      return [`Outro: ${value.trim()}`];
    }
    return [];
  });

  return linhas.length ? linhas.map((linha) => `• ${linha}`).join('\n') : 'Nenhuma opção marcada';
}

function formatarValor(value: unknown, field: ReportFieldDef): string {
  if (value !== null && typeof value === 'object') {
    return formatarGrupo(value as Record<string, unknown>, field.options);
  }

  const texto = value === null || value === undefined ? '' : String(value).trim();
  return texto || NAO_INFORMADO;
}

export function buildReportSections(report: ReportsData): ReportSection[] {
  return REPORT_SECTIONS.map((section) => {
    const dados = report[section.key] as Record<string, unknown> | null;

    return {
      title: section.title,
      rows: dados
        ? section.fields.map((field) => ({
            label: field.label,
            value: formatarValor(dados[field.key], field),
          }))
        : null,
    };
  });
}

// Tira os caracteres que o Windows recusa em nome de arquivo.
export function reportFileName(nome: string): string {
  const base = nome.replace(/[\/:*?"<>|]/g, '').trim().replace(/\s+/g, '_');
  return `Relatorio_${base || 'estudante'}.pdf`;
}
