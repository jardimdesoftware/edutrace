export interface StudentData {
  id: number;
  full_name: string;
  cpf: string;
  email: string;
  affliation: string | null;
  pedagogical_manager: string | null;
  enrollment_number?: string | null;
  course?: string | null;
  created_at: string; 
  updated_at: string; 
  deleted_at: string | null;
  id_level: number;
  id_current_phase: number;
}
