import { PROFESSOR_AEE } from "@/consts";
import { temPapel, type Papeis } from "./papeis";

export interface EstudanteDaAgenda {
  id: number;
  full_name: string;
  email: string;
}

export interface Atendimento {
  id: number;
  starts_at: string;
  ends_at: string;
  notes: string | null;
  student: EstudanteDaAgenda;
}

const DIAS_DA_SEMANA = 7;
const MAX_OBSERVACAO = 500;

// A agenda é só do Professor do AEE, como as rotas /aee-appointments do back.
// Quem protege o dado é o back; aqui só decide se o atalho aparece.
export function podeVerAgenda(roles: Papeis): boolean {
  return temPapel(roles, PROFESSOR_AEE);
}

function doisDigitos(n: number): string {
  return String(n).padStart(2, "0");
}

// Segunda-feira, 00:00 no horário local, da semana que contém a data.
export function inicioDaSemana(referencia: Date): Date {
  const inicio = new Date(referencia.getFullYear(), referencia.getMonth(), referencia.getDate());
  const desdeSegunda = (inicio.getDay() + 6) % 7;
  inicio.setDate(inicio.getDate() - desdeSegunda);
  return inicio;
}

export function somarDias(data: Date, dias: number): Date {
  const nova = new Date(data.getFullYear(), data.getMonth(), data.getDate());
  nova.setDate(nova.getDate() + dias);
  return nova;
}

export function diasDaSemana(inicio: Date): Date[] {
  return Array.from({ length: DIAS_DA_SEMANA }, (_, i) => somarDias(inicio, i));
}

// O período que a API recebe: da segunda 00:00 à segunda seguinte 00:00.
export function intervaloDaSemana(inicio: Date): { from: string; to: string } {
  return { from: inicio.toISOString(), to: somarDias(inicio, DIAS_DA_SEMANA).toISOString() };
}

// AAAA-MM-DD no horário local, o formato do input de data.
export function chaveDoDia(data: Date): string {
  return `${data.getFullYear()}-${doisDigitos(data.getMonth() + 1)}-${doisDigitos(data.getDate())}`;
}

export function formatarHora(iso: string): string {
  const data = new Date(iso);
  return `${doisDigitos(data.getHours())}:${doisDigitos(data.getMinutes())}`;
}

// Data e hora digitadas (horário local) viram o instante ISO que a API guarda.
export function paraIso(data: string, hora: string): string {
  const [ano, mes, dia] = data.split("-").map(Number);
  const [h, min] = hora.split(":").map(Number);
  return new Date(ano, mes - 1, dia, h, min).toISOString();
}

export interface CamposDoHorario {
  data: string;
  inicio: string;
  fim: string;
  observacao: string;
}

// Devolve a mensagem do primeiro problema, ou null quando o horário é válido.
export function validarHorario({ data, inicio, fim, observacao }: CamposDoHorario): string | null {
  if (!data || !inicio || !fim) return "Informe a data e os horários de início e fim.";
  if (fim <= inicio) return "O horário de fim deve ser depois do início.";
  if (observacao.length > MAX_OBSERVACAO) {
    return `A observação aceita no máximo ${MAX_OBSERVACAO} caracteres.`;
  }
  return null;
}

// Agrupa por dia local, mantendo a ordem em que a API devolve (início crescente).
export function agruparPorDia(atendimentos: Atendimento[]): Record<string, Atendimento[]> {
  return atendimentos.reduce<Record<string, Atendimento[]>>((grupos, atendimento) => {
    const chave = chaveDoDia(new Date(atendimento.starts_at));
    return { ...grupos, [chave]: [...(grupos[chave] ?? []), atendimento] };
  }, {});
}

const HORA_INICIAL_PADRAO = 7;
const HORA_FINAL_PADRAO = 19;

function minutosDoDia(iso: string): number {
  const data = new Date(iso);
  return data.getHours() * 60 + data.getMinutes();
}

// Faixa de horas da grade: 07h às 19h, ampliada para caber qualquer atendimento.
export function faixaDeHoras(atendimentos: Atendimento[]): { inicio: number; fim: number } {
  const inicios = atendimentos.map((a) => Math.floor(minutosDoDia(a.starts_at) / 60));
  const fins = atendimentos.map((a) => {
    const fim = minutosDoDia(a.ends_at);
    // Atendimento que termina em 00:00 vai até o fim da grade.
    return fim === 0 ? 24 : Math.ceil(fim / 60);
  });
  return {
    inicio: Math.min(HORA_INICIAL_PADRAO, ...inicios),
    fim: Math.max(HORA_FINAL_PADRAO, ...fins),
  };
}

// Posição do bloco na coluna do dia, em minutos a partir da primeira hora da grade.
export function posicaoDoBloco(a: Atendimento, horaInicial: number): { topo: number; altura: number } {
  const inicio = minutosDoDia(a.starts_at);
  const fim = minutosDoDia(a.ends_at) || 24 * 60;
  return { topo: inicio - horaInicial * 60, altura: Math.max(fim - inicio, 15) };
}

export function rotuloDoDia(data: Date): string {
  return data.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit" });
}

export function rotuloDaSemana(inicio: Date): string {
  const fim = somarDias(inicio, DIAS_DA_SEMANA - 1);
  const formato = (d: Date) => d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  return `${formato(inicio)} a ${formato(fim)}`;
}

// Linhas da tabela do PDF: data, horário, estudante e observação.
export function linhasDoPdf(atendimentos: Atendimento[]): string[][] {
  return atendimentos.map((a) => [
    new Date(a.starts_at).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" }),
    `${formatarHora(a.starts_at)} às ${formatarHora(a.ends_at)}`,
    a.student.full_name,
    a.notes ?? "",
  ]);
}

export function nomeDoArquivoDaAgenda(inicio: Date): string {
  return `Agenda_${chaveDoDia(inicio)}.pdf`;
}
