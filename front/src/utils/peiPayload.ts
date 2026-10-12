import type { PlansEducationData } from "@/interfaces/PlansEducationData";

export type PlansEducationPayload = Omit<
  PlansEducationData,
  "professor_email" | "professor_name"
>;

const AUTHOR_FIELDS = new Set(["professor_email", "professor_name"]);

// Corpo do POST do PEI. A autoria é gravada pela API a partir do usuário da
// sessão, então o corpo leva só o formulário e os dados do estudante.
export function buildPEIPayload(
  form: PlansEducationData,
  studentEmail: string,
  studentName: string,
): PlansEducationPayload {
  const fields = Object.fromEntries(
    Object.entries(form).filter(([field]) => !AUTHOR_FIELDS.has(field)),
  ) as Omit<PlansEducationPayload, "student_email" | "student_name">;

  return { ...fields, student_email: studentEmail, student_name: studentName };
}
