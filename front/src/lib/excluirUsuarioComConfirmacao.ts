import Swal from "sweetalert2";
import { deleteUser, getDeletionPreview, type RespostaDaExclusao } from "@/api/user";
import type { StudentData } from "@/interfaces/StudentData";
import { ApiError } from "@/services/http";
import {
  corpoDaExclusao,
  janelaDeSenhaAberta,
  textoDoAvisoDaLixeira,
} from "@/utils/exclusaoDeUsuario";
import { rotulosDosPapeis } from "@/utils/papeis";

const ID = {
  aviso: "exclusao-aviso",
  papeis: "exclusao-papeis",
  senha: "exclusao-senha",
  lembrar: "exclusao-lembrar",
} as const;

type Desfecho =
  | { tipo: "excluido"; resposta: RespostaDaExclusao }
  | { tipo: "pedir-senha" };

// O html do SweetAlert2 só leva marcação fixa. O nome, o e-mail e os papéis são
// dados de usuário e entram por textContent em didOpen, nunca no html.
function htmlDoModal(pedirSenha: boolean): string {
  const campos = pedirSenha
    ? `<label for="${ID.senha}" class="block text-left text-sm font-semibold mt-4">Sua senha</label>
       <input id="${ID.senha}" type="password" autocomplete="current-password" class="swal2-input w-full" style="margin: 0.25rem 0 0.75rem" />
       <label class="flex items-center gap-2 text-left text-sm">
         <input id="${ID.lembrar}" type="checkbox" />
         Lembrar minha senha por 10 minutos
       </label>`
    : "";

  return `<p id="${ID.aviso}" class="text-left"></p>
    <p id="${ID.papeis}" class="text-left text-sm mt-2"></p>
    ${campos}`;
}

// A prévia diz se a conta tem dados. Se ela falhar, o aviso fala dos dois casos,
// e a exclusão segue possível.
async function buscarTemDados(id: number): Promise<boolean | null> {
  try {
    return (await getDeletionPreview(id)).has_data;
  } catch (error) {
    console.error("Não foi possível consultar os dados da conta.", error);
    return null;
  }
}

function preencher(alvo: StudentData, temDados: boolean | null): void {
  const aviso = document.getElementById(ID.aviso);
  const papeis = document.getElementById(ID.papeis);

  if (aviso) {
    aviso.textContent = textoDoAvisoDaLixeira(alvo, temDados, new Date());
  }

  if (papeis) {
    papeis.textContent = `Papéis: ${rotulosDosPapeis(alvo.roles).join(", ")}`;
  }
}

async function enviar(alvo: StudentData): Promise<Desfecho | false> {
  const senha = (document.getElementById(ID.senha) as HTMLInputElement | null)?.value ?? "";
  const lembrar = (document.getElementById(ID.lembrar) as HTMLInputElement | null)?.checked ?? false;

  try {
    const resposta = await deleteUser(alvo.id, corpoDaExclusao(senha, lembrar));
    return { tipo: "excluido", resposta };
  } catch (error) {
    // 401 sem senha enviada: a janela de 10 minutos acabou no servidor, e o
    // modal volta com o campo de senha.
    if (error instanceof ApiError && error.status === 401 && !senha) {
      return { tipo: "pedir-senha" };
    }

    Swal.showValidationMessage(
      error instanceof Error ? error.message : "Erro ao desativar o usuário",
    );
    return false;
  }
}

// Pede a confirmação e inicia a carência do usuário. A confirmação sempre
// aparece; o campo de senha só some enquanto a janela que o back abriu vale.
// Devolve null quando o administrador cancela.
export async function excluirUsuarioComConfirmacao(
  alvo: StudentData,
  janelaAte: string | null,
): Promise<RespostaDaExclusao | null> {
  let pedirSenha = !janelaDeSenhaAberta(janelaAte, new Date());
  const temDados = await buscarTemDados(alvo.id);

  for (;;) {
    const confirmacao = await Swal.fire<Desfecho>({
      icon: "warning",
      title: "Desativar usuário",
      html: htmlDoModal(pedirSenha),
      showCancelButton: true,
      confirmButtonColor: "#b91c1c",
      cancelButtonColor: "#6b7280",
      confirmButtonText: "Sim, desativar",
      cancelButtonText: "Cancelar",
      showLoaderOnConfirm: true,
      allowOutsideClick: () => !Swal.isLoading(),
      didOpen: () => preencher(alvo, temDados),
      preConfirm: () => enviar(alvo),
    });

    if (!confirmacao.isConfirmed || !confirmacao.value) return null;

    if (confirmacao.value.tipo === "excluido") {
      return confirmacao.value.resposta;
    }

    pedirSenha = true;
  }
}
