import { ServiceStatus } from '@prisma/client';

// Todo usuário que passa a ser Estudante/Família entra no fim da fila de atendimento.
// Cadastro, conta criada pelo login com Google e troca de nível para Estudante
// gravam este mesmo par, que o CHECK User_service_status_level_chk exige.
export function enterQueue(now: Date = new Date()) {
  return { service_status: ServiceStatus.WAITING, queued_at: now };
}

// Quem deixa de ser estudante perde o estado de atendimento, inclusive o
// responsável, o que libera a vaga do Professor do AEE que o atendia. Matrícula e curso
// ficam: são dados do cadastro, e não da fila.
export const LEAVE_QUEUE = {
  service_status: null,
  queued_at: null,
  service_started_at: null,
  service_closed_at: null,
  aee_responsible_id: null,
} as const;

// O responsável pedagógico, de servidor ou de pessoa externa, é dado do
// estudante. Quem deixa de ser estudante o perde junto com a fila, na mesma
// escrita: o telefone e o CPF do externo são dados de terceiro, que não têm por
// que ficar numa conta que deixou de ser estudante.
export const LEAVE_PEDAGOGICAL_MANAGER = {
  pedagogical_manager_id: null,
  external_manager_name: null,
  external_manager_phone: null,
  external_manager_cpf: null,
} as const;
