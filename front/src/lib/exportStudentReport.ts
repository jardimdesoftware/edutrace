import { getReportByEmail } from "@/api/reports";
import type { ReportsData } from "@/interfaces/ReportsData";
import type { StudentData } from "@/interfaces/StudentData";
import { buildReportSections, relatorioVazio, reportFileName } from "@/utils/reportSections";
import type { jsPDF } from "jspdf";

type Estudante = Pick<StudentData, "email" | "full_name">;

const MARGEM = 40;
// Verde dos botões e alertas do sistema (#047857).
const VERDE: [number, number, number] = [4, 120, 87];
const CINZA_CLARO: [number, number, number] = [240, 244, 242];

// Monta o PDF do relatório. O jsPDF é carregado só na exportação, para não pesar
// no carregamento da home.
// ponytail: Helvetica padrão (WinAnsi) cobre os acentos do português, mas
// caractere fora do Latin-1 (emoji, por exemplo) sai trocado; se aparecer nos
// formulários, embutir uma fonte TTF com doc.addFont.
export async function renderReportPdf(
  estudante: Estudante,
  report: ReportsData,
  geradoEm: Date = new Date(),
): Promise<jsPDF> {
  const [{ jsPDF }, { autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const largura = doc.internal.pageSize.getWidth();
  const altura = doc.internal.pageSize.getHeight();

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(...VERDE);
  doc.text("EduTrace", MARGEM, 50);
  doc.setFontSize(13);
  doc.setTextColor(0);
  doc.text("Relatório do estudante", MARGEM, 72);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Nome: ${estudante.full_name}`, MARGEM, 94);
  doc.text(`E-mail: ${estudante.email}`, MARGEM, 108);
  doc.text(`Gerado em: ${geradoEm.toLocaleString("pt-BR")}`, MARGEM, 122);

  const body = buildReportSections(report).flatMap((section) => [
    [
      {
        content: section.title,
        colSpan: 2,
        styles: { fillColor: VERDE, textColor: 255, fontStyle: "bold" as const, fontSize: 11 },
      },
    ],
    ...(section.rows
      ? section.rows.map((row) => [row.label, row.value])
      : [[{ content: "Ficha não preenchida.", colSpan: 2, styles: { fontStyle: "italic" as const } }]]),
  ]);

  autoTable(doc, {
    startY: 140,
    body,
    theme: "grid",
    margin: { left: MARGEM, right: MARGEM, bottom: 40 },
    styles: { font: "helvetica", fontSize: 9, cellPadding: 5, valign: "top", lineColor: 200 },
    columnStyles: { 0: { cellWidth: 170, fontStyle: "bold", fillColor: CINZA_CLARO } },
  });

  const paginas = doc.getNumberOfPages();
  doc.setFontSize(8);
  doc.setTextColor(100);
  for (let pagina = 1; pagina <= paginas; pagina++) {
    doc.setPage(pagina);
    doc.text(`Página ${pagina} de ${paginas}`, largura - MARGEM, altura - 20, { align: "right" });
  }

  return doc;
}

// Gera e baixa o relatório do estudante em PDF, com a triagem e o PEI.
// Retorna "empty" quando o estudante não tem nenhuma das duas fichas; lança em erros inesperados.
export async function exportStudentReportPdf(estudante: Estudante): Promise<"downloaded" | "empty"> {
  const report: ReportsData = await getReportByEmail(estudante.email);

  if (relatorioVazio(report)) {
    return "empty";
  }

  const doc = await renderReportPdf(estudante, report);
  doc.save(reportFileName(estudante.full_name));

  return "downloaded";
}
