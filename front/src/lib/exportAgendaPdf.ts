import type { jsPDF } from "jspdf";
import { registrarDownload } from "@/api/auditLogs";
import {
  linhasDoPdf,
  nomeDoArquivoDaAgenda,
  rotuloDaSemana,
  type Atendimento,
} from "@/utils/agenda";

const MARGEM = 40;
// Verde dos botões e alertas do sistema (#047857), o mesmo do relatório do estudante.
const VERDE: [number, number, number] = [4, 120, 87];

// Monta o PDF da agenda da semana. O jsPDF é carregado só na exportação.
export async function renderAgendaPdf(
  professor: string,
  inicioDaSemana: Date,
  atendimentos: Atendimento[],
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
  doc.text("Agenda de atendimento", MARGEM, 72);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Professor(a): ${professor}`, MARGEM, 94);
  doc.text(`Período: ${rotuloDaSemana(inicioDaSemana)}`, MARGEM, 108);
  doc.text(`Gerado em: ${geradoEm.toLocaleString("pt-BR")}`, MARGEM, 122);

  autoTable(doc, {
    startY: 140,
    head: [["Data", "Horário", "Estudante", "Observação"]],
    body: linhasDoPdf(atendimentos),
    theme: "grid",
    margin: { left: MARGEM, right: MARGEM, bottom: 40 },
    headStyles: { fillColor: VERDE, textColor: 255 },
    styles: { font: "helvetica", fontSize: 9, cellPadding: 5, valign: "top", lineColor: 200 },
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

// Gera e baixa a agenda da semana. Retorna "empty" quando não há atendimento no período.
export async function exportAgendaPdf(
  professor: string,
  inicioDaSemana: Date,
  atendimentos: Atendimento[],
): Promise<"downloaded" | "empty"> {
  if (atendimentos.length === 0) return "empty";

  const doc = await renderAgendaPdf(professor, inicioDaSemana, atendimentos);
  await registrarDownload("AeeAgenda");
  doc.save(nomeDoArquivoDaAgenda(inicioDaSemana));

  return "downloaded";
}
