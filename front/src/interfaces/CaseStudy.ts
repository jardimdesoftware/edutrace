export interface CaseStudySections {
  identification: {
    grade: string;
    age?: number | null;
    date?: string | null;
  };
  general_info: {
    diagnosis: string;
    has_medical_report: boolean;
    follow_ups: {
      health: boolean;
      therapies: boolean;
      other: string;
    };
  };
  school_history: {
    time_at_institution: string;
    previous_specialized_services: string;
    main_difficulties: string;
    observed_potentialities: string;
  };
  pedagogical_aspects: {
    language: {
      verbal: boolean;
      gestures: boolean;
      alternative_communication: boolean;
      frequent_mediation: boolean;
      notes: string;
    };
    reading_writing: {
      recognizes_letters: boolean;
      recognizes_syllables: boolean;
      reads_words: boolean;
      reads_sentences: boolean;
      spontaneous_writing: boolean;
      copies_texts: boolean;
      needs_adaptation: boolean;
      notes: string;
    };
    math: {
      recognizes_numbers: boolean;
      counts: boolean;
      simple_operations: boolean;
      problem_solving: boolean;
      needs_concrete_material: boolean;
      notes: string;
    };
  };
  behavioral_social: {
    peer_interaction: string;
    teacher_interaction: string;
    participation: string;
    interfering_behaviors: string;
  };
  potentialities_interests: string;
  barriers: string;
  resources_strategies: {
    accessibility_resources: string;
    pedagogical_strategies: string;
    curricular_adaptations: string;
    adaptation_justification: string;
  };
  pei_recommendations: {
    priority_objectives: string;
    referrals: string;
    teacher_guidance: string;
  };
  aee_opinion: {
    opinion: string;
    date?: string | null;
  };
}

export interface CaseStudyAuthor {
  id: number;
  full_name: string;
}

export interface CaseStudyStudent {
  full_name: string;
  course: string | null;
}

export interface CaseStudy extends CaseStudySections {
  author: CaseStudyAuthor | null;
  student: CaseStudyStudent;
  created_at: string;
  updated_at: string;
}

export type CaseStudyPayload = CaseStudySections;
