import Swal from "sweetalert2";
import { FICHAS_DO_RELATORIO, type FichaDoRelatorio } from "@/utils/reportSections";

const CLASSE_DA_OPCAO = "edutrace-ficha-do-relatorio";

// O html só traz rótulos fixos do sistema, nunca texto vindo de um usuário.
function htmlDasOpcoes(): string {
  const opcoes = FICHAS_DO_RELATORIO.map(
    ({ chave, rotulo }) =>
      `<label style="display:flex;align-items:center;gap:8px;margin:6px 0;text-align:left">` +
      `<input type="checkbox" class="${CLASSE_DA_OPCAO}" value="${chave}" checked />${rotulo}</label>`,
  ).join("");

  return `<p style="margin-bottom:8px">Escolha os formulários que entram no PDF:</p>${opcoes}`;
}

// Pergunta quais formulários entram no PDF. Devolve null quando o usuário cancela.
export async function escolherFichasDoRelatorio(): Promise<FichaDoRelatorio[] | null> {
  const resultado = await Swal.fire({
    title: "Exportar relatório em PDF",
    html: htmlDasOpcoes(),
    showCancelButton: true,
    confirmButtonColor: "#047857",
    cancelButtonColor: "#6b7280",
    confirmButtonText: "Exportar",
    cancelButtonText: "Cancelar",
    preConfirm: () => {
      const marcadas = Array.from(
        Swal.getPopup()?.querySelectorAll<HTMLInputElement>(`.${CLASSE_DA_OPCAO}:checked`) ?? [],
      ).map((opcao) => opcao.value as FichaDoRelatorio);

      if (marcadas.length === 0) {
        Swal.showValidationMessage("Marque ao menos um formulário.");
        return false;
      }
      return marcadas;
    },
  });

  return resultado.isConfirmed ? (resultado.value as FichaDoRelatorio[]) : null;
}
