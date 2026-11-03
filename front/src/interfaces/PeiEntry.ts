// Par da lista "Conteúdo previsto na ementa e adequação" do registro do PEI.
export interface SyllabusAdaptation {
  syllabus_content: string;
  adaptation: string;
}

// Os sete campos que o professor preenche e que o PATCH pode trocar.
export interface PeiEntryContent {
  adapted_objectives: string;
  prioritized_contents: string;
  syllabus_adaptations: SyllabusAdaptation[];
  adapted_methodologies: string;
  adapted_assessments: string;
  adapted_resources: string;
  general_notes: string;
}

// Registro do PEI de um estudante em um semestre (AAAA.S) e uma disciplina.
// id_author e author vêm null quando o professor autor foi excluído.
export interface PeiEntry extends PeiEntryContent {
  id: number;
  semester: string;
  subject: string;
  created_at: string;
  updated_at: string | null;
  id_author: number | null;
  author: { full_name: string } | null;
}

// Semestre e disciplina só entram na criação: o PATCH não os aceita.
export type NewPeiEntryPayload = PeiEntryContent & {
  student_email: string;
  semester: string;
  subject: string;
};

export type PeiEntryUpdatePayload = Partial<PeiEntryContent>;
