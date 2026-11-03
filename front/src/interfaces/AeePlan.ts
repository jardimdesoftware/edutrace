export interface AeePlanSections {
  identification: {
    subject: string;
    weekly_hours?: number;
    enrolled_subjects: string;
  };
  basis: string;
  has_diagnosis: boolean;
  supports: {
    psychology: boolean;
    social_assistance: boolean;
    psychopedagogy: boolean;
    medical: boolean;
    medical_specialty: string;
    physiotherapy: boolean;
    speech_therapy: boolean;
    equine_therapy: boolean;
    braille_transcription: boolean;
    libras_interpreter: boolean;
    libras_teacher: boolean;
    other: string;
  };
  purpose: {
    curricular_complementation: boolean;
    curricular_supplementation: boolean;
    materials_adaptation: boolean;
    assistive_technology: boolean;
    systematic_follow_up: boolean;
    other: string;
  };
  objectives: {
    general: string;
    specific: string;
  };
  evaluation_procedures: string;
}

export interface AeePlanAuthor {
  id: number;
  full_name: string;
}

export interface AeePlanStudent {
  full_name: string;
  course: string | null;
}

export interface AeePlan extends AeePlanSections {
  id: number;
  // Período letivo no formato AAAA.S, único por estudante.
  semester: string;
  author: AeePlanAuthor | null;
  student: AeePlanStudent;
  created_at: string;
  updated_at: string;
}

// O PATCH não aceita o período: ele não muda depois que o PAEE é criado.
export type AeePlanPayload = AeePlanSections;
