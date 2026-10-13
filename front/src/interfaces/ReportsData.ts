import { PlansEducationData } from "./PlansEducationData";
import { ScreeningData } from "./ScreeningData";

export interface ReportsData {
    screening: Omit<ScreeningData, "full_name" | "email" | "special_service"> | null
    plansEducation: Omit<PlansEducationData, "student_email" | "student_name"> | null
}
