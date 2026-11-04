import { PROFISSIONAL_NAPNE } from '@/consts';
import type { ProfessionalLoad, ServiceQueue, ServiceStats } from '@/interfaces/ServiceStats';
import type { ServiceStatus } from '@/interfaces/StudentData';
import { temPapel, type Papeis } from './papeis';
import { rotuloDoStatus, STATUS_ATENDIMENTO } from './atendimento';

const MS_POR_DIA = 24 * 60 * 60 * 1000;

// A data de entrada na fila vem em UTC. O sistema atende o Brasil, que desde
// 2019 não tem horário de verão, então o fuso fixo mostra o mesmo dia em
// qualquer máquina.
const FUSO_DO_SISTEMA = 'America/Sao_Paulo';

export type SituacaoDoProfissional = 'COM_VAGAS' | 'NO_LIMITE';

const ROTULOS_DA_SITUACAO: Record<SituacaoDoProfissional, string> = {
  COM_VAGAS: 'Com vagas',
  NO_LIMITE: 'No limite',
};

export interface TotalDoPainel {
  status: ServiceStatus;
  rotulo: string;
  valor: number;
  detalhe: string | null;
  alunoMaisAntigo: { id: number; nome: string } | null;
}

export interface OcupacaoDoProfissional {
  id: number;
  nome: string;
  ocupacao: string;
  vagas: string;
  situacao: SituacaoDoProfissional;
  rotuloSituacao: string;
  percentual: number;
}

export interface PainelDeAtendimento {
  totais: TotalDoPainel[];
  profissionais: OcupacaoDoProfissional[];
}

// Mesmo critério da rota GET /students/service-stats no back
// (@AllowLevels do Profissional NAPNE). Quem protege o dado
// é o back; aqui só decide se o painel aparece.
export function podeVerEstatisticas(roles: Papeis): boolean {
  return temPapel(roles, PROFISSIONAL_NAPNE);
}

function esperaEmDias(dias: number): string {
  if (dias === 0) return 'há menos de 1 dia';
  return dias === 1 ? 'há 1 dia' : `há ${dias} dias`;
}

// Os dias contam períodos completos de 24 horas desde a entrada. Uma data de
// entrada à frente do relógio (diferença de relógio entre servidor e navegador)
// vale como menos de 1 dia, nunca como espera negativa.
export function textoDaEsperaMaisAntiga(fila: ServiceQueue, agora: Date): string {
  if (fila.size === 0) return 'Ninguém aguardando';

  const entrada = fila.oldest_queued_at ? new Date(fila.oldest_queued_at) : null;
  if (!entrada || Number.isNaN(entrada.getTime())) return 'Data de entrada não registrada';

  const dias = Math.max(0, Math.floor((agora.getTime() - entrada.getTime()) / MS_POR_DIA));
  const desde = entrada.toLocaleDateString('pt-BR', { timeZone: FUSO_DO_SISTEMA });
  return `Espera mais antiga: ${esperaEmDias(dias)} (desde ${desde})`;
}

export function ocupacaoDoProfissional(profissional: ProfessionalLoad): OcupacaoDoProfissional {
  const { id, full_name: nome, in_service: emAtendimento, capacity, free } = profissional;
  const vagas = Math.max(0, free);

  const situacao = vagas === 0 ? 'NO_LIMITE' : 'COM_VAGAS';
  return {
    id,
    nome,
    ocupacao: `${emAtendimento} de ${capacity}`,
    vagas: String(vagas),
    situacao,
    rotuloSituacao: ROTULOS_DA_SITUACAO[situacao],
    percentual: Math.min(100, Math.round((emAtendimento / capacity) * 100)),
  };
}

// Tudo que a tela mostra, já em texto. "agora" entra por parâmetro para a
// espera da fila não depender do relógio da máquina que roda o teste.
export function montarPainel(estatisticas: ServiceStats, agora: Date): PainelDeAtendimento {
  const { queue } = estatisticas;
  const maisAntigo = queue.oldest_student;

  return {
    totais: STATUS_ATENDIMENTO.map((status) => ({
      status,
      rotulo: rotuloDoStatus(status),
      valor: estatisticas.totals[status],
      detalhe: status === 'WAITING' ? textoDaEsperaMaisAntiga(queue, agora) : null,
      alunoMaisAntigo:
        status === 'WAITING' && maisAntigo
          ? { id: maisAntigo.id, nome: maisAntigo.full_name }
          : null,
    })),
    profissionais: estatisticas.professionals.map(ocupacaoDoProfissional),
  };
}
