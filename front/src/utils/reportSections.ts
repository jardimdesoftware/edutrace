import type { ReportsData } from '@/interfaces/ReportsData';
import { secoesParaLeitura } from './estudoDeCaso';
import { secoesDoPlanoParaLeitura } from './paee';
import { secoesDoPeiParaLeitura } from './pei';
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
const TITULO_ESTUDO_DE_CASO = 'Estudo de Caso';
const TITULO_PAEE = 'PAEE';
const TITULO_PEI = 'PEI';

export function relatorioVazio(report: ReportsData): boolean {
  return (
    !report.screening &&
    !report.peiEntries?.length &&
    !report.caseStudy &&
    !report.aeePlans?.length
  );
}

// Texto das opções que não têm rótulo no formulário, gerado a partir da chave.
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

// O estudo de caso é longo, então sai uma seção do relatório por seção da ficha.
// Os rótulos e os itens marcados são os mesmos da tela. Sem estudo de caso (null,
// ou ausente quando a API não o envia), sai uma seção sem linhas, como nas
// outras fichas.
function secoesDoEstudoDeCaso(estudo: ReportsData['caseStudy']): ReportSection[] {
  if (!estudo) return [{ title: TITULO_ESTUDO_DE_CASO, rows: null }];

  return secoesParaLeitura(estudo, estudo.student?.course).map((secao) => ({
    title: `${TITULO_ESTUDO_DE_CASO} - ${secao.titulo}`,
    rows: secao.linhas,
  }));
}

// O PAEE é refeito a cada período letivo, então sai uma seção do relatório por
// período, na ordem da API (do mais recente para o mais antigo), com as seções
// da ficha em sequência, com o curso do estudante primeiro. Sem nenhum PAEE
// (lista vazia, ou ausente quando a API não a envia), sai uma seção sem linhas,
// como nas outras fichas.
function secoesDoPaee(planos: ReportsData['aeePlans']): ReportSection[] {
  if (!planos?.length) return [{ title: TITULO_PAEE, rows: null }];

  return planos.map((plano) => ({
    title: `${TITULO_PAEE} - ${plano.semester}`,
    rows: secoesDoPlanoParaLeitura(plano, plano.student?.course).flatMap((secao) => secao.linhas),
  }));
}

// O PEI tem um registro por semestre e disciplina, então sai uma seção do
// relatório por registro, na ordem da API (do semestre mais recente para o mais
// antigo, e por disciplina dentro dele), com as seções do registro em sequência.
// Sem nenhum registro (lista vazia, ou ausente quando a API não a envia), sai uma
// seção sem linhas, como nas outras fichas.
function secoesDoPei(registros: ReportsData['peiEntries']): ReportSection[] {
  if (!registros?.length) return [{ title: TITULO_PEI, rows: null }];

  return registros.map((registro) => ({
    title: `${TITULO_PEI} - ${registro.semester} - ${registro.subject}`,
    rows: secoesDoPeiParaLeitura(registro).flatMap((secao) => secao.linhas),
  }));
}

// As fichas que o relatório em PDF pode trazer. A exportação deixa escolher
// quais entram; sem escolha, entram todas.
export type FichaDoRelatorio = 'screening' | 'peiEntries' | 'caseStudy' | 'aeePlans';

export const FICHAS_DO_RELATORIO: ReadonlyArray<{ chave: FichaDoRelatorio; rotulo: string }> = [
  { chave: 'screening', rotulo: 'Triagem' },
  { chave: 'peiEntries', rotulo: TITULO_PEI },
  { chave: 'caseStudy', rotulo: TITULO_ESTUDO_DE_CASO },
  { chave: 'aeePlans', rotulo: TITULO_PAEE },
];

const TODAS_AS_FICHAS: readonly FichaDoRelatorio[] = FICHAS_DO_RELATORIO.map((ficha) => ficha.chave);

// As fichas que o estudante já tem preenchidas.
export function fichasPreenchidas(report: ReportsData): FichaDoRelatorio[] {
  return TODAS_AS_FICHAS.filter((chave) => {
    const valor = report[chave];
    return Array.isArray(valor) ? valor.length > 0 : Boolean(valor);
  });
}

export function buildReportSections(
  report: ReportsData,
  fichasEscolhidas: readonly FichaDoRelatorio[] = TODAS_AS_FICHAS,
): ReportSection[] {
  const triagem = REPORT_SECTIONS.map((section) => {
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

  const incluir = (ficha: FichaDoRelatorio, secoes: () => ReportSection[]) =>
    fichasEscolhidas.includes(ficha) ? secoes() : [];

  return [
    ...incluir('screening', () => triagem),
    ...incluir('peiEntries', () => secoesDoPei(report.peiEntries)),
    ...incluir('caseStudy', () => secoesDoEstudoDeCaso(report.caseStudy)),
    ...incluir('aeePlans', () => secoesDoPaee(report.aeePlans)),
  ];
}

// Tira os caracteres que o Windows recusa em nome de arquivo.
export function reportFileName(nome: string): string {
  const base = nome.replace(/[\/:*?"<>|]/g, '').trim().replace(/\s+/g, '_');
  return `Relatorio_${base || 'estudante'}.pdf`;
}
