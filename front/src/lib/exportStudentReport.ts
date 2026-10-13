import { getReportByEmail } from "@/api/reports";
import { ReportsData } from "@/interfaces/ReportsData";
import { StudentData } from "@/interfaces/StudentData";
import { relatorioVazio } from "@/utils/reportSections";
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

// Gera e baixa o relatório do estudante em Excel (.xlsx), com a triagem e o PEI.
// Retorna "empty" quando o estudante não tem nenhuma das duas fichas; lança em erros inesperados.
export async function exportStudentReportXlsx(
  estudante: Pick<StudentData, "email" | "full_name">,
): Promise<"downloaded" | "empty"> {
  const report: ReportsData = await getReportByEmail(estudante.email);

  if (relatorioVazio(report)) {
    return "empty";
  }

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
  createSheet(report.plansEducation, "Plano Educacional");

  const studentName = estudante.full_name || "estudante";
  const fileName = `Relatorio_${String(studentName).replace(/\s+/g, "_")}.xlsx`;
  XLSX.writeFile(workbook, fileName);

  return "downloaded";
}
