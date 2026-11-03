import { PROFISSIONAL_NAPNE } from '@/consts';
import { temPapel, type UsuarioLogado } from '@/utils/papeis';
import type { ServiceStatus, StudentData } from '@/interfaces/StudentData';

export type FiltroStatus = ServiceStatus | 'TODOS';

export const STATUS_ATENDIMENTO: readonly ServiceStatus[] = [
  'WAITING',
  'IN_SERVICE',
  'CLOSED',
];

const ROTULOS: Record<ServiceStatus, string> = {
  WAITING: 'Fila de espera',
  IN_SERVICE: 'Em atendimento',
  CLOSED: 'Encerrado',
};

export const OPCOES_FILTRO_STATUS: readonly { value: FiltroStatus; label: string }[] = [
  { value: 'TODOS', label: 'Todos' },
  ...STATUS_ATENDIMENTO.map((status) => ({ value: status, label: ROTULOS[status] })),
];

// Só estudante tem status. Para os outros níveis, que a tabela do administrador
// também lista, o rótulo é vazio: a coluna fica sem conteúdo na linha.
export function rotuloDoStatus(status?: ServiceStatus | null): string {
  return status ? ROTULOS[status] : '';
}

// Depois que o atendimento encerra, o NAPNE guardado na linha é quem atendeu,
// e não mais quem responde pelo estudante.
export function rotuloDoResponsavel(status: ServiceStatus): string {
  return status === 'CLOSED' ? 'Atendido por' : 'Responsável';
}

function instanteNaFila(usuario: StudentData): number {
  const instante = usuario.queued_at ? Date.parse(usuario.queued_at) : NaN;
  return Number.isNaN(instante) ? Infinity : instante;
}

function compararEntradaNaFila(a: StudentData, b: StudentData): number {
  const [x, y] = [instanteNaFila(a), instanteNaFila(b)];
  return x === y ? 0 : x < y ? -1 : 1;
}

// Com "TODOS" a lista segue como veio da API. Com um status, ficam só as
// linhas dele; na fila de espera, os que entraram primeiro vêm primeiro.
export function filtrarPorStatus(
  usuarios: readonly StudentData[],
  filtro: FiltroStatus,
): StudentData[] {
  if (filtro === 'TODOS') return [...usuarios];

  const doStatus = usuarios.filter((usuario) => usuario.service_status === filtro);
  return filtro === 'WAITING' ? doStatus.sort(compararEntradaNaFila) : doStatus;
}

// Conta sobre a lista carregada. Quem não tem status (nível diferente de
// estudante) não entra em nenhuma contagem.
export function contarPorStatus(
  usuarios: readonly StudentData[],
): Record<ServiceStatus, number> {
  const contagem: Record<ServiceStatus, number> = {
    WAITING: 0,
    IN_SERVICE: 0,
    CLOSED: 0,
  };
  for (const { service_status } of usuarios) {
    if (service_status) contagem[service_status] += 1;
  }
  return contagem;
}

export function textoDaContagem(contagem: Record<ServiceStatus, number>): string {
  return STATUS_ATENDIMENTO.map(
    (status) => `${ROTULOS[status]}: ${contagem[status]}`,
  ).join(' · ');
}

// As ações são do Profissional NAPNE. A regra definitiva é do back; aqui só
// decide quando o botão aparece.
export function podeAssumirAtendimento(
  estudante: Pick<StudentData, 'service_status'>,
  usuario?: UsuarioLogado | null,
): boolean {
  return (
    temPapel(usuario?.roles, PROFISSIONAL_NAPNE) && estudante.service_status === 'WAITING'
  );
}

export function podeEncerrarAtendimento(
  estudante: Pick<StudentData, 'service_status' | 'napne_responsible'>,
  usuario?: UsuarioLogado | null,
): boolean {
  return (
    temPapel(usuario?.roles, PROFISSIONAL_NAPNE) &&
    estudante.service_status === 'IN_SERVICE' &&
    estudante.napne_responsible != null &&
    estudante.napne_responsible.id === usuario?.sub
  );
}
