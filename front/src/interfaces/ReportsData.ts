import { AeePlan, AeePlanAuthor, AeePlanStudent } from "./AeePlan";
import { CaseStudy, CaseStudyAuthor, CaseStudyStudent } from "./CaseStudy";
import { PlansEducationData } from "./PlansEducationData";
import { ScreeningData } from "./ScreeningData";

// O relatório traz do estudante só o curso, que o PDF imprime na Identificação,
// e do autor só o nome.
type CaseStudyDoRelatorio = Omit<CaseStudy, "created_at" | "updated_at" | "student" | "author"> & {
    student: Pick<CaseStudyStudent, "course">
    author: Pick<CaseStudyAuthor, "full_name"> | null
}

// Do PAEE o relatório traz o período, as seções, só o nome do autor e só o curso
// do estudante.
type AeePlanDoRelatorio = Omit<AeePlan, "id" | "student" | "author" | "created_at" | "updated_at"> & {
    student: Pick<AeePlanStudent, "course">
    author: Pick<AeePlanAuthor, "full_name"> | null
}

export interface ReportsData {
    screening: Omit<ScreeningData, "full_name" | "email" | "special_service"> | null
    plansEducation: Omit<PlansEducationData, "student_email" | "student_name"> | null
    caseStudy?: CaseStudyDoRelatorio | null
    aeePlans?: AeePlanDoRelatorio[]
}
