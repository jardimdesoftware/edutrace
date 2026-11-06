export type ServiceStatus = "WAITING" | "IN_SERVICE" | "CLOSED";

export interface StudentData {
  id: number;
  full_name: string;
  cpf: string;
  email: string;
  affliation: string | null;
  pedagogical_manager?: { id: number; full_name: string } | null;
  external_manager_name?: string | null;
  external_manager_phone?: string | null;
  external_manager_cpf?: string | null;
  enrollment_number?: string | null;
  course?: string | null;
  created_at: string; 
  updated_at: string; 
  deleted_at: string | null;
  // Só o administrador recebe este campo preenchido: a lista dos demais não traz
  // desativados.
  deactivated_at?: string | null;
  roles: number[];
  id_current_phase: number;
  service_status?: ServiceStatus | null;
  queued_at?: string | null;
  service_started_at?: string | null;
  service_closed_at?: string | null;
  aee_responsible?: { id: number; full_name: string } | null;
}
