import { ServiceStatus } from '@prisma/client';

// Os mesmos limites do CHECK User_service_capacity_chk. Zero é válido: o NAPNE
// continua com o nível, mas não assume ninguém.
export const SERVICE_CAPACITY_MIN = 0;
export const SERVICE_CAPACITY_MAX = 200;

// Todo usuário que passa a ser Estudante/Família entra no fim da fila do NAPNE.
// Cadastro, conta criada pelo login com Google e troca de nível para Estudante
// gravam este mesmo par, que o CHECK User_service_status_level_chk exige.
export function enterQueue(now: Date = new Date()) {
  return { service_status: ServiceStatus.WAITING, queued_at: now };
}

// Quem deixa de ser estudante perde o estado de atendimento, inclusive o
// responsável, o que libera a vaga do NAPNE que o atendia. Matrícula e curso
// ficam: são dados do cadastro, e não da fila.
export const LEAVE_QUEUE = {
  service_status: null,
  queued_at: null,
  service_started_at: null,
  service_closed_at: null,
  napne_responsible_id: null,
} as const;
