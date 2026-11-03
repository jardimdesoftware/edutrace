import { AeePlan, AeePlanAuthor, AeePlanStudent } from "./AeePlan";
import { CaseStudy, CaseStudyAuthor, CaseStudyStudent } from "./CaseStudy";
import { PeiEntry, PeiEntryContent } from "./PeiEntry";
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

// Do PEI o relatório traz o semestre, a disciplina, os campos de conteúdo e só o
// nome do professor autor.
type PeiEntryDoRelatorio = PeiEntryContent & Pick<PeiEntry, "semester" | "subject" | "author">

export interface ReportsData {
    screening: Omit<ScreeningData, "full_name" | "email" | "special_service"> | null
    peiEntries?: PeiEntryDoRelatorio[]
    caseStudy?: CaseStudyDoRelatorio | null
    aeePlans?: AeePlanDoRelatorio[]
}
