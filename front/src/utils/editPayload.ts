// Corpo do PATCH das telas de edição. A API recusa com 400 qualquer campo fora
// do DTO de atualização, e as telas preenchem o formulário com o registro do
// GET, que traz id, datas, o e-mail do titular e a autoria do PEI.
export function pickFields<T extends object, K extends keyof T>(
  source: T,
  fields: readonly K[],
): Pick<T, K> {
  return Object.fromEntries(
    fields.map((field) => [field, source[field]]),
  ) as Pick<T, K>;
}

// Campos de UpdateScreeningDto.
export const SCREENING_EDIT_FIELDS = [
  "full_name",
  "report",
  "specific_need",
  "special_service",
  "physical_disability",
  "visual_impairment",
  "hearing_impairment",
  "global_disorder",
  "other_disabilities",
] as const;

// Campos de UpdateAnamnesisDto.
export const ANAMNESIS_EDIT_FIELDS = [
  "identification",
  "family_data",
  "family_conditions",
  "mother_background",
  "verbal_language_three_years",
  "development",
  "school_information",
  "sexuality",
  "student_assessment",
  "student_development",
] as const;

// Campos de UpdatePlansEducationDto.
export const PEI_EDIT_FIELDS = [
  "student_name",
  "academic_semester",
  "service_modality",
  "support_service",
  "skills",
  "resource_equipment_used",
  "resource_equipment_needs",
  "curriculum_accessibility",
  "school_content",
  "activities_to_be_developed",
  "objectives",
  "work_methodology",
  "materials_used",
  "evaluation_criteria",
] as const;
