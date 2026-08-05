import { getReportByEmail } from "@/api/reports";
import * as XLSX from "xlsx";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function objectToKeyValue(obj: any, prefix = ""): { Chave: string; Valor: string }[] {
  return Object.entries(obj).reduce((acc, [key, value]) => {
    if (["id", "created_at", "updated_at", "deleted_at"].includes(key)) return acc;
    const formattedKey = key.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
    const newKey = prefix ? `${prefix} -> ${formattedKey}` : formattedKey;

    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      acc.push(...objectToKeyValue(value, newKey));
    } else {
      let displayValue: string;
      if (typeof value === "boolean") displayValue = value ? "Sim" : "Não";
      else if (value === null || value === undefined || value === "") displayValue = "Não informado";
      else displayValue = String(value);
      acc.push({ Chave: newKey, Valor: displayValue });
    }
    return acc;
  }, [] as { Chave: string; Valor: string }[]);
}

// Gera e baixa o relatório do estudante em Excel (.xlsx) a partir do e-mail.
// Retorna "empty" quando não há relatório para o estudante; lança em erros inesperados.
export async function exportStudentReportXlsx(email: string): Promise<"downloaded" | "empty"> {
  const response = await getReportByEmail(email);
  const rawReport = Array.isArray(response) ? response[0] : response;

  if (!rawReport) {
    return "empty";
  }

  const report = {
    screening: {
      full_name: rawReport.full_name,
      specific_need: rawReport.specific_need,
      special_service: rawReport.special_service,
      physical_disability: rawReport.physical_disability,
      visual_impairment: rawReport.visual_impairment,
      hearing_impairment: rawReport.hearing_impairment,
      global_disorder: rawReport.global_disorder,
      other_disabilities: rawReport.other_disabilities,
    },
    anamnesis: {
      identification: rawReport.identification,
      family_data: rawReport.family_data,
      family_conditions: rawReport.family_conditions,
      mother_background: rawReport.mother_background,
      verbal_language_three_years: rawReport.verbal_language_three_years,
      development: rawReport.development,
      sexuality: rawReport.sexuality,
      student_assessment: rawReport.student_assessment,
      student_development: rawReport.student_development,
      school_information: rawReport.school_information,
    },
    plansEducation: {
      academic_semester: rawReport.academic_semester,
      service_modality: rawReport.service_modality,
      support_service: rawReport.support_service,
      skills: rawReport.skills,
      resource_equipment_used: rawReport.resource_equipment_used,
      resource_equipment_needs: rawReport.resource_equipment_needs,
      curriculum_accessibility: rawReport.curriculum_accessibility,
      school_content: rawReport.school_content,
      activities_to_be_developed: rawReport.activities_to_be_developed,
      objectives: rawReport.objectives,
      materials_used: rawReport.materials_used,
      evaluation_criteria: rawReport.evaluation_criteria,
      work_methodology: rawReport.work_methodology,
    },
  };

  const workbook = XLSX.utils.book_new();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const createSheet = (data: any, sheetName: string) => {
    if (data && Object.keys(data).length > 0) {
      const worksheetData = objectToKeyValue(data);
      const worksheet = XLSX.utils.json_to_sheet(worksheetData, { header: ["Chave", "Valor"] });
      worksheet["!cols"] = [{ wch: 50 }, { wch: 50 }];
      XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    }
  };

  createSheet(report.screening, "Triagem");
  createSheet(report.anamnesis, "Anamnese Completa");
  createSheet(report.plansEducation, "Plano Educacional");

  const studentName = report.screening?.full_name || "estudante";
  const fileName = `Relatorio_${String(studentName).replace(/\s+/g, "_")}.xlsx`;
  XLSX.writeFile(workbook, fileName);

  return "downloaded";
}
