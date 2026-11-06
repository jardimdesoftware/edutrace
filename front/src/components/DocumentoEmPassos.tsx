"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import Swal from "sweetalert2";
import { ESTUDANTE } from "@/consts";
import { useAuth } from "@/contexts/AuthContext";
import { useEstudanteDaUrl } from "@/hooks/useEstudanteDaUrl";
import { errorAlertOptions } from "@/utils/errorAlert";
import { rotaDoEstudante } from "@/utils/estudanteDaUrl";
import {
  secoesDeLeitura,
  type ErrosDoFormulario,
  type SecaoDef,
} from "@/utils/formularioPorTabela";
import { canAccessPage } from "@/utils/pageAccess";
import type { TipoDeFormulario, VersaoCompleta } from "@/utils/historicoDeEdicoes";
import { temPapel } from "@/utils/papeis";
import type { ModoDoFormulario } from "./AcoesDoAssistente";
import AppLayout from "./AppLayout";
import AvisoDeVersao from "./AvisoDeVersao";
import FormularioPorTabela from "./FormularioPorTabela";
import { useHistoricoDeEdicoes } from "./HistoricoDeEdicoes";
import Loading from "./Loading";
import { BOTAO_PERIGO, COR_CANCELAR, COR_CONFIRMAR, COR_EXCLUIR } from "./form/botoes";

interface DocumentoEmPassosProps<R extends object, F extends object, P extends object> {
  // "Anamnese", "Triagem": os dois são femininos, e as mensagens concordam.
  titulo: string;
  // Qual histórico de versões a tela consulta.
  tipoDeFormulario: TipoDeFormulario;
  secoes: readonly SecaoDef[];
  prefixoDosIds: string;
  // Rota que decide quem edita (a regra está em pageAccess) e a rota da leitura,
  // para onde volta quem abre a edição sem poder editar.
  chaveDeEdicao: string;
  rotaDaLeitura: string;
  // A tela de edição abre direto no formulário de um documento que já existe.
  iniciarEditando?: boolean;
  carregar: (email: string) => Promise<R>;
  criar: (email: string, nome: string | null, corpo: P) => Promise<unknown>;
  atualizar: (email: string, corpo: P) => Promise<unknown>;
  excluir: (email: string) => Promise<unknown>;
  formularioVazio: () => F;
  formularioDoDocumento: (documento: R) => F;
  montarCorpo: (form: F) => P;
  validar: (form: F) => ErrosDoFormulario;
  // Conteúdo da última página, para o documento que já existe (por exemplo, o
  // encaminhamento da anamnese).
  extraDoUltimoPasso?: (contexto: { email: string; nome: string | null }) => ReactNode;
}

// Página de um documento do estudante que se cria, lê, edita e exclui em passos
// (anamnese e triagem): quem pode editar cria e edita, quem não pode só lê, e o
// estudante lê o próprio.
export default function DocumentoEmPassos<R extends object, F extends object, P extends object>({
  titulo,
  tipoDeFormulario,
  secoes,
  prefixoDosIds,
  chaveDeEdicao,
  rotaDaLeitura,
  iniciarEditando = false,
  carregar,
  criar,
  atualizar,
  excluir,
  formularioVazio,
  formularioDoDocumento,
  montarCorpo,
  validar,
  extraDoUltimoPasso,
}: DocumentoEmPassosProps<R, F, P>) {
  const router = useRouter();
  const { id, email, nome, carregando } = useEstudanteDaUrl();
  const { user, loading } = useAuth();
  const [documento, setDocumento] = useState<R | null>(null);
  const [carregandoDocumento, setCarregandoDocumento] = useState(true);
  const [editando, setEditando] = useState(iniciarEditando);
  const [salvando, setSalvando] = useState(false);
  // Versão antiga aberta pelo histórico: a tela mostra o conteúdo dela, só para leitura.
  const [versaoVista, setVersaoVista] = useState<VersaoCompleta<R> | null>(null);

  const minusculo = titulo.toLowerCase();
  const podeEditar = !!user && canAccessPage(chaveDeEdicao, user.roles);
  const alvo = user && temPapel(user.roles, ESTUDANTE) ? user.email : email;
  const voltarParaOEstudante = () => router.push(rotaDoEstudante("/estudantes/visualizar", id));
  const historico = useHistoricoDeEdicoes<R>({
    tipo: tipoDeFormulario,
    email: alvo,
    roles: user?.roles,
    atualizadoEm: (documento as { updated_at?: string | null } | null)?.updated_at,
    versaoAberta: versaoVista?.version ?? null,
    onEscolher: setVersaoVista,
  });

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.push("/login");
      return;
    }
    if (iniciarEditando && !podeEditar) {
      router.replace(rotaDoEstudante(rotaDaLeitura, id));
    }
  }, [loading, user, iniciarEditando, podeEditar, router, rotaDaLeitura, id]);

  useEffect(() => {
    if (loading || !alvo) return;

    let ativo = true;
    async function buscar(destino: string) {
      try {
        const encontrado = await carregar(destino);
        if (ativo) setDocumento(encontrado);
      } catch (error) {
        // O estudante sem o documento recebe 404: é a tela de criação.
        console.error('%s não encontrada, iniciando a criação.', titulo, error);
        if (ativo) setDocumento(null);
      } finally {
        if (ativo) setCarregandoDocumento(false);
      }
    }
    buscar(alvo);

    return () => {
      ativo = false;
    };
  }, [alvo, loading, carregar, titulo]);

  const avisarFalha = (falha: string, error: unknown, padrao: string) =>
    Swal.fire({
      ...errorAlertOptions(falha, error, padrao),
      confirmButtonColor: COR_CONFIRMAR,
      confirmButtonText: "Entendi",
    });

  const handleSalvar = async (corpo: P) => {
    if (!alvo) return;

    setSalvando(true);
    try {
      if (documento) await atualizar(alvo, corpo);
      else await criar(alvo, nome, corpo);
      setDocumento(await carregar(alvo));
      setVersaoVista(null);
    } catch (error) {
      console.error('Erro ao salvar a %s:', minusculo, error);
      await avisarFalha(`Falha ao salvar a ${minusculo}`, error, `Não foi possível salvar a ${minusculo}.`);
      setSalvando(false);
      return;
    }

    setEditando(false);
    setSalvando(false);
    Swal.fire({
      icon: "success",
      title: `${titulo} salva com sucesso!`,
      confirmButtonColor: COR_CONFIRMAR,
      confirmButtonText: "Ok",
    });
  };

  const handleExcluir = async () => {
    if (!alvo) return;

    const confirmacao = await Swal.fire({
      icon: "warning",
      title: `Excluir ${minusculo}`,
      text: `Deseja excluir a ${minusculo} de "${nome?.trim() || "o estudante"}"? Esta ação não pode ser desfeita.`,
      showCancelButton: true,
      confirmButtonColor: COR_EXCLUIR,
      cancelButtonColor: COR_CANCELAR,
      confirmButtonText: "Sim, excluir",
      cancelButtonText: "Cancelar",
    });
    if (!confirmacao.isConfirmed) return;

    try {
      await excluir(alvo);
    } catch (error) {
      console.error('Erro ao excluir a %s:', minusculo, error);
      await avisarFalha(`Falha ao excluir a ${minusculo}`, error, `Não foi possível excluir a ${minusculo}.`);
      return;
    }

    // A tela do estudante fica em outro root layout que a da home, e a navegação
    // recarrega a página: o alerta sairia junto se não esperasse fechar.
    await Swal.fire({
      icon: "success",
      title: `${titulo} excluída com sucesso!`,
      confirmButtonColor: COR_CONFIRMAR,
      confirmButtonText: "Ok",
    });
    voltarParaOEstudante();
  };

  if (loading || carregando || carregandoDocumento || !user) return <Loading />;

  if (!documento && !podeEditar) {
    return (
      <AppLayout>
        <div className="w-full p-4 lg:min-h-0 lg:flex-1 lg:p-6">
          <div className="mx-auto w-full max-w-3xl space-y-6">
            <header className="space-y-1">
              <h1 className="text-4xl font-bold">{titulo}</h1>
              {nome && <p className="text-gray-600">Estudante: {nome}</p>}
            </header>
            <div className="space-y-4 rounded-2xl border border-gray-200 bg-white p-6">
              <p className="text-gray-700">
                {temPapel(user.roles, ESTUDANTE) ? "Você" : nome?.trim() || "o estudante"} ainda não tem {minusculo}.
              </p>
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  const exibido = versaoVista ? versaoVista.snapshot : documento;
  const modo: ModoDoFormulario = !documento
    ? "criar"
    : !versaoVista && editando && podeEditar
      ? "editar"
      : "ver";

  return (
    <AppLayout ocuparTela>
      <div className="w-full p-4 lg:min-h-0 lg:flex-1 lg:p-6">
        <FormularioPorTabela
          key={`${modo}-${versaoVista?.version ?? "atual"}`}
          titulo={titulo}
          estudante={nome ?? undefined}
          secoes={secoes}
          prefixoDosIds={prefixoDosIds}
          inicial={exibido ? formularioDoDocumento(exibido) : formularioVazio()}
          validar={validar}
          modo={modo}
          salvando={salvando}
          onSalvar={(form) => handleSalvar(montarCorpo(form))}
          onCancelar={() => (modo === "editar" ? setEditando(false) : voltarParaOEstudante())}
          onEditar={podeEditar && !versaoVista ? () => setEditando(true) : undefined}
          leituraDoPasso={exibido ? (passo) => secoesDeLeitura(passo, exibido) : undefined}
          extraDoUltimoPasso={
            documento && alvo && !versaoVista && extraDoUltimoPasso
              ? extraDoUltimoPasso({ email: alvo, nome: nome ?? null })
              : undefined
          }
          ladoDoTitulo={modo === "ver" ? historico.autoria : undefined}
          aviso={
            versaoVista ? (
              <AvisoDeVersao versao={versaoVista} onVoltar={() => setVersaoVista(null)} />
            ) : undefined
          }
          acoesDoDocumento={
            modo === "ver" && (historico.botao || (podeEditar && !versaoVista)) ? (
              <div className="flex flex-wrap items-center gap-3">
                {historico.botao}
                {podeEditar && !versaoVista && (
                  <button type="button" className={BOTAO_PERIGO} onClick={handleExcluir}>
                    <Trash2 size={16} aria-hidden="true" />
                    Excluir
                  </button>
                )}
              </div>
            ) : undefined
          }
        />
      </div>
    </AppLayout>
  );
}
