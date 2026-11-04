// components/TabelaEstudantes.tsx

"use client";

import {
  assumirAtendimento,
  encerrarAtendimento,
  getStudentByEmail,
} from "@/api/students";
import { restoreUser, updateUser } from "@/api/user";
import { ADMIN } from "@/consts";
import { useAuth } from "@/contexts/AuthContext";
import { StudentData } from "@/interfaces/StudentData";
import { excluirUsuarioComConfirmacao } from "@/lib/excluirUsuarioComConfirmacao";
import { exportStudentReportPdf } from "@/lib/exportStudentReport";
import {
  contarPorStatus,
  FiltroStatus,
  filtrarPorStatus,
  OPCOES_FILTRO_STATUS,
  podeAssumirAtendimento,
  podeEncerrarAtendimento,
  textoDaContagem,
} from "@/utils/atendimento";
import { errorAlertOptions } from "@/utils/errorAlert";
import {
  FiltroPapel,
  filtrarPorPapel,
  lerFiltroPapel,
  OPCOES_FILTRO_PAPEL,
} from "@/utils/filtroPorPapel";
import { paginar, textoDoIntervalo } from "@/utils/paginacao";
import {
  estaMarcado,
  motivoDaLixeiraDesativada,
  podeExcluir,
  podeRestaurar,
  textoDaExclusao,
} from "@/utils/exclusaoDeUsuario";
import {
  rotulosDosPapeis,
  temPapel,
} from "@/utils/papeis";
import { rotaDoEstudante } from "@/utils/estudanteDaUrl";
import { canAccessPage } from "@/utils/pageAccess";
import { podeDefinirResponsavel } from "@/utils/responsavelPedagogico";
import {
  listarUsuariosDaTabela,
  podeExportarRelatorio,
  responsavelDaLinha,
  substituirUsuario,
} from "@/utils/tabelaUsuarios";
import { ChevronLeft, ChevronRight, Eye, FileDown, Search, Trash2, Undo2, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import Swal from "sweetalert2";
import AtendimentoEstudante from "./AtendimentoEstudante";
import Loading from "./Loading";
import EditorDePapeis from "./EditorDePapeis";
import ResponsavelPedagogico from "./ResponsavelPedagogico";

interface AcaoAtendimento {
  chamar: (email: string) => Promise<StudentData>;
  titulo: string;
  pergunta: (nome: string) => string;
  confirmar: string;
  sucesso: string;
  falha: string;
  falhaPadrao: string;
}

const ASSUMIR: AcaoAtendimento = {
  chamar: assumirAtendimento,
  titulo: "Assumir atendimento",
  pergunta: (nome) => `Deseja assumir o atendimento de "${nome}"?`,
  confirmar: "Sim, assumir",
  sucesso: "Atendimento assumido com sucesso!",
  falha: "Falha ao assumir o atendimento",
  falhaPadrao: "Não foi possível assumir o atendimento.",
};

const ENCERRAR: AcaoAtendimento = {
  chamar: encerrarAtendimento,
  titulo: "Encerrar atendimento",
  pergunta: (nome) => `Deseja encerrar o atendimento de "${nome}"?`,
  confirmar: "Sim, encerrar",
  sucesso: "Atendimento encerrado com sucesso!",
  falha: "Falha ao encerrar o atendimento",
  falhaPadrao: "Não foi possível encerrar o atendimento.",
};

const NENHUM_ESTUDANTE = "Nenhum estudante encontrado.";

export default function TabelaEstudantes() {
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>("TODOS");
  const [filtroPapel, setFiltroPapel] = useState<FiltroPapel>("TODOS");
  const [pagina, setPagina] = useState(1);
  const [acaoEmAndamento, setAcaoEmAndamento] = useState(false);
  // Fim da janela de senha que o back abriu com "lembrar". O back é quem vale; o
  // valor só decide se o modal mostra o campo de senha.
  const janelaDeSenha = useRef<string | null>(null);
  const router = useRouter();
  const [ students, setStudents ] = useState<StudentData[] | null>(null);
  const { user, loading } = useAuth();

  const isAdmin = temPapel(user?.roles, ADMIN);
  const podeCadastrar = !!user && canAccessPage("/admin/usuarios/cadastro", user.roles);
  const totalColunas = 7;

  // O administrador gerencia contas, então filtra pelos papéis do sistema; o
  // filtro de atendimento é dos profissionais.
  const buscados = students?.filter(e => e.full_name.toLowerCase().includes(busca.toLowerCase()));
  const filtrados = buscados && (
    isAdmin
      ? filtrarPorPapel(buscados, filtroPapel)
      : filtrarPorStatus(buscados, filtroStatus)
  );
  const paginado = filtrados && paginar(filtrados, pagina);

  const handleVerEstudante = (estudante: StudentData) => {
    router.push(rotaDoEstudante('/estudantes/visualizar', estudante.id));
  };

  const handleExportar = async (estudante: StudentData) => {
    try {
      const resultado = await exportStudentReportPdf(estudante);
      if (resultado === "empty") {
        Swal.fire({
          icon: "info",
          title: "Nenhum relatório encontrado",
          text: "Não foram encontrados relatórios para o paciente.",
          confirmButtonColor: "#047857",
          confirmButtonText: "Entendi",
        });
      }
    } catch (error) {
      console.error("Erro ao exportar relatório:", error);
      Swal.fire({
        icon: "error",
        title: "Falha ao exportar",
        text: "Ocorreu um erro inesperado ao gerar o relatório.",
        confirmButtonColor: "#047857",
        confirmButtonText: "Entendi",
      });
    }
  };

  const renderResponsavel = (estudante: StudentData) =>
    podeDefinirResponsavel(user, estudante) ? (
      <ResponsavelPedagogico
        estudante={estudante}
        onAtualizado={(atualizado) =>
          setStudents((prev) => prev && substituirUsuario(prev, atualizado))
        }
      />
    ) : (
      responsavelDaLinha(estudante)
    );

  const handleAlterarPapeis = async (estudante: StudentData, novosPapeis: number[]): Promise<void> => {
    const confirmacao = await Swal.fire({
      icon: "warning",
      title: "Alterar papéis",
      text: `Tem certeza que deseja alterar os papéis de "${estudante.full_name}" para "${rotulosDosPapeis(novosPapeis).join(", ")}"?`,
      showCancelButton: true,
      confirmButtonColor: "#047857",
      cancelButtonColor: "#6b7280",
      confirmButtonText: "Sim, alterar",
      cancelButtonText: "Cancelar",
    });

    if (!confirmacao.isConfirmed) return;

    try {
      const atualizado = await updateUser(estudante.email, novosPapeis);
      setStudents((prev) => prev && substituirUsuario(prev, atualizado));
      Swal.fire({
        icon: "success",
        title: "Papéis atualizados com sucesso!",
        confirmButtonColor: "#047857",
        confirmButtonText: "Ok",
      });
    } catch (error) {
      console.error(error);
      Swal.fire({
        ...errorAlertOptions(
          "Falha ao atualizar os papéis",
          error,
          "Não foi possível atualizar os papéis.",
        ),
        confirmButtonColor: "#047857",
        confirmButtonText: "Entendi",
      });
    }
  };

  const handleExcluir = async (alvo: StudentData): Promise<void> => {
    try {
      const resultado = await excluirUsuarioComConfirmacao(alvo, janelaDeSenha.current);
      if (!resultado) return;

      janelaDeSenha.current = resultado.reauth_until ?? janelaDeSenha.current;
      setStudents((prev) => prev && substituirUsuario(prev, resultado.user));
      await Swal.fire({
        icon: "success",
        title: "Usuário marcado para exclusão",
        text: `A conta fica sem acesso e será apagada em definitivo. ${textoDaExclusao(resultado.user.deleted_at ?? new Date().toISOString())}.`,
        confirmButtonColor: "#047857",
        confirmButtonText: "Ok",
      });
    } catch (error) {
      console.error(error);
      Swal.fire({
        ...errorAlertOptions(
          "Falha ao excluir o usuário",
          error,
          "Não foi possível excluir o usuário.",
        ),
        confirmButtonColor: "#047857",
        confirmButtonText: "Entendi",
      });
    }
  };

  const handleRestaurar = async (alvo: StudentData): Promise<void> => {
    const confirmacao = await Swal.fire({
      icon: "question",
      title: "Restaurar usuário",
      text: `Deseja restaurar o acesso de "${alvo.full_name}"?`,
      showCancelButton: true,
      confirmButtonColor: "#047857",
      cancelButtonColor: "#6b7280",
      confirmButtonText: "Sim, restaurar",
      cancelButtonText: "Cancelar",
    });

    if (!confirmacao.isConfirmed) return;

    try {
      const restaurado = await restoreUser(alvo.id);
      setStudents((prev) => prev && substituirUsuario(prev, restaurado));
      Swal.fire({
        icon: "success",
        title: "Usuário restaurado com sucesso!",
        confirmButtonColor: "#047857",
        confirmButtonText: "Ok",
      });
    } catch (error) {
      console.error(error);
      Swal.fire({
        ...errorAlertOptions(
          "Falha ao restaurar o usuário",
          error,
          "Não foi possível restaurar o usuário.",
        ),
        confirmButtonColor: "#047857",
        confirmButtonText: "Entendi",
      });
    }
  };

  const recarregarLinha = async (email: string) => {
    try {
      const lido: StudentData | null = await getStudentByEmail(email);
      if (lido) {
        setStudents((prev) => prev && substituirUsuario(prev, lido));
        return;
      }
    } catch (error) {
      console.error("Erro ao reler o estudante", error);
    }
    try {
      setStudents(await listarUsuariosDaTabela(user?.roles));
    } catch (error) {
      console.error("Erro ao recarregar a lista de estudantes", error);
    }
  };

  const handleAtendimento = async (estudante: StudentData, acao: AcaoAtendimento) => {
    const confirmacao = await Swal.fire({
      icon: "question",
      title: acao.titulo,
      text: acao.pergunta(estudante.full_name),
      showCancelButton: true,
      confirmButtonColor: "#047857",
      cancelButtonColor: "#6b7280",
      confirmButtonText: acao.confirmar,
      cancelButtonText: "Cancelar",
    });

    if (!confirmacao.isConfirmed) return;

    setAcaoEmAndamento(true);
    try {
      const atualizado = await acao.chamar(estudante.email);
      setStudents((prev) => prev && substituirUsuario(prev, atualizado));
      Swal.fire({
        icon: "success",
        title: acao.sucesso,
        confirmButtonColor: "#047857",
        confirmButtonText: "Ok",
      });
    } catch (error) {
      console.error(error);
      Swal.fire({
        ...errorAlertOptions(acao.falha, error, acao.falhaPadrao),
        confirmButtonColor: "#047857",
        confirmButtonText: "Entendi",
      });
      await recarregarLinha(estudante.email);
    } finally {
      setAcaoEmAndamento(false);
    }
  };

  useEffect(() => {
    async function fetchData() {
      try {
        const data = await listarUsuariosDaTabela(user?.roles);
        setStudents(data);
      } catch (error) {
        console.error("Erro ao buscar estudantes", error);
      }
    }
    fetchData();
  }, [user?.roles]);


  const renderAtendimento = (estudante: StudentData) => (
    <AtendimentoEstudante
      estudante={estudante}
      podeAssumir={podeAssumirAtendimento(estudante, user)}
      podeEncerrar={podeEncerrarAtendimento(estudante, user)}
      ocupado={acaoEmAndamento}
      onAssumir={() => handleAtendimento(estudante, ASSUMIR)}
      onEncerrar={() => handleAtendimento(estudante, ENCERRAR)}
    />
  );

  if (loading) return <Loading fullScreen={false} />;

  const totaisDoAtendimento = students ? contarPorStatus(students) : null;

  return (
    <div className="overflow-hidden rounded-2xl border border-[#dce8f4] bg-white/95 shadow-[0_14px_40px_rgba(28,67,112,0.08)]">
      <div className="p-4 sm:p-5">
        <h1 className="edutrace-page-title">
          {isAdmin ? "Gestão de pessoas" : "Estudantes"}
        </h1>
        {!isAdmin && (
          <p className="mt-1.5 text-sm leading-5 text-slate-600">
            Consulte os estudantes e acompanhe a situação de cada atendimento.
          </p>
        )}

        <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          {podeCadastrar && (
            <button
              type="button"
              onClick={() => router.push("/admin/usuarios/cadastro")}
              className="inline-flex h-11 items-center justify-center gap-2 self-start rounded-lg bg-[#006ee8] px-4 text-sm font-bold text-white shadow-[0_6px_14px_rgba(0,110,232,0.20)] transition hover:bg-[#005fc9] focus:outline-none focus:ring-4 focus:ring-[#b8dcff]"
            >
              <UserPlus className="h-5 w-5" aria-hidden="true" />
              Cadastrar novas pessoas
            </button>
          )}
          <div className="flex flex-col gap-3 lg:ml-auto sm:flex-row sm:items-center">
          {isAdmin ? (
            <label className="flex items-center gap-2 text-sm font-semibold text-[#0b2455]">
              <span className="font-semibold">Papel:</span>
              <select
                value={filtroPapel}
                onChange={(e) => {
                  setFiltroPapel(lerFiltroPapel(e.target.value));
                  setPagina(1);
                }}
                className="h-11 min-w-48 rounded-xl border border-[#a9c5e8] bg-white px-3 outline-none transition focus:border-[#006ee8] focus:ring-4 focus:ring-[#dcecff]"
              >
                {OPCOES_FILTRO_PAPEL.map((opcao) => (
                  <option key={opcao.value} value={opcao.value}>
                    {opcao.label}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <label className="flex items-center gap-2 text-sm font-semibold text-[#0b2455]">
              <span className="font-semibold">Atendimento:</span>
              <select
                value={filtroStatus}
                onChange={(e) => {
                  setFiltroStatus(e.target.value as FiltroStatus);
                  setPagina(1);
                }}
                className="h-11 min-w-48 rounded-xl border border-[#a9c5e8] bg-white px-3 outline-none transition focus:border-[#006ee8] focus:ring-4 focus:ring-[#dcecff]"
              >
                {OPCOES_FILTRO_STATUS.map((opcao) => (
                  <option key={opcao.value} value={opcao.value}>
                    {opcao.label}
                  </option>
                ))}
              </select>
            </label>
          )}
            <label className="flex h-11 w-full items-center gap-3 rounded-lg border border-[#a9c5e8] bg-white px-3 transition focus-within:border-[#006ee8] focus-within:ring-4 focus-within:ring-[#dcecff] sm:w-72">
              <Search className="h-5 w-5 shrink-0 text-[#315a91]" aria-hidden="true" />
              <span className="sr-only">Buscar pessoa por nome, CPF ou e-mail</span>
              <input
                type="search"
                placeholder="Por quem você busca?"
                value={busca}
                onChange={(e) => {
                  setBusca(e.target.value);
                  setPagina(1);
                }}
                className="min-w-0 flex-1 bg-transparent text-[#17233f] outline-none placeholder:text-slate-400"
              />
            </label>
          </div>
        </div>
      </div>

      {totaisDoAtendimento && !isAdmin && (
        <dl role="status" aria-label={textoDaContagem(totaisDoAtendimento)} className="flex flex-wrap gap-2 border-t border-[#e5edf6] bg-[#f8fbff] px-4 py-3 sm:px-5">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm text-amber-900">
            <dt>Fila de espera</dt><dd className="font-bold">{totaisDoAtendimento.WAITING}</dd>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm text-emerald-900">
            <dt>Em atendimento</dt><dd className="font-bold">{totaisDoAtendimento.IN_SERVICE}</dd>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700">
            <dt>Encerrados</dt><dd className="font-bold">{totaisDoAtendimento.CLOSED}</dd>
          </div>
        </dl>
      )}

      <div className="md:hidden px-4 pb-4 space-y-3">
        {paginado?.itens.map((estudante) => (
          <div key={estudante.id} className="border rounded-lg p-4 shadow-sm">
            <div className="space-y-1 text-sm">
              <p><span className="font-semibold">Nome:</span> {estudante.full_name}</p>
              {estudante.deleted_at && (
                <p>
                  <span className="inline-block rounded bg-red-100 px-2 py-0.5 text-xs text-red-800">
                    {textoDaExclusao(estudante.deleted_at)}
                  </span>
                </p>
              )}
              <p><span className="font-semibold">CPF:</span> {estudante.cpf}</p>
              <p className="break-all"><span className="font-semibold">E-mail:</span> {estudante.email}</p>
              <p><span className="font-semibold">Responsável Pedagógico:</span> {renderResponsavel(estudante)}</p>
              {isAdmin ? (
                <EditorDePapeis
                  key={`m-${estudante.id}-${estudante.roles.join(",")}`}
                  idBase={`papeis-m-${estudante.id}`}
                  nome={estudante.full_name}
                  gravado={estudante.roles}
                  onSalvar={(papeis) => handleAlterarPapeis(estudante, papeis)}
                />
              ) : (
                <p><span className="font-semibold">Papéis:</span> {rotulosDosPapeis(estudante.roles).join(", ")}</p>
              )}
              {estudante.service_status && (
                <div className="flex flex-wrap items-start gap-2">
                  <span className="font-semibold">Atendimento:</span>
                  {renderAtendimento(estudante)}
                </div>
              )}
            </div>
            <div className="mt-3 flex gap-2">
              {!isAdmin && (
                <button
                  onClick={() => handleVerEstudante(estudante)}
                  title="Mais informações"
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded border px-3 py-2 text-sm text-gray-700 shadow-sm hover:bg-gray-50 hover:shadow"
                >
                  <Eye className="w-4 h-4" />
                  Visualizar
                </button>
              )}
              {!isAdmin && podeExportarRelatorio(estudante) && (
                <button
                  onClick={() => handleExportar(estudante)}
                  title="Exportar relatório"
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded border px-3 py-2 text-sm text-gray-700 shadow-sm hover:bg-gray-50 hover:shadow"
                >
                  <FileDown className="w-4 h-4" />
                  Exportar
                </button>
              )}
              {isAdmin && podeRestaurar(user, estudante) && (
                <button
                  onClick={() => handleRestaurar(estudante)}
                  title="Restaurar usuário"
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded border px-3 py-2 text-sm text-gray-700 shadow-sm hover:bg-gray-50 hover:shadow"
                >
                  <Undo2 className="w-4 h-4" />
                  Restaurar
                </button>
              )}
              {isAdmin && !estaMarcado(estudante) && (
                <button
                  onClick={() => handleExcluir(estudante)}
                  title={motivoDaLixeiraDesativada(user, estudante) ?? "Excluir usuário"}
                  disabled={!podeExcluir(user, estudante)}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded border px-3 py-2 text-sm text-red-700 shadow-sm hover:bg-red-50 hover:shadow disabled:cursor-not-allowed disabled:text-gray-400 disabled:hover:bg-transparent disabled:hover:shadow-none"
                >
                  <Trash2 className="w-4 h-4" />
                  Excluir
                </button>
              )}
            </div>
          </div>
        ))}
        {filtrados?.length === 0 && (
          <p className="py-4 text-center text-sm text-gray-600">{NENHUM_ESTUDANTE}</p>
        )}
      </div>

      <div className="hidden overflow-x-auto border-t border-[#dce8f4] md:block">
        <table className="min-w-full table-auto text-sm text-left">
          <thead className="bg-[#eef4fa] text-[#0b2455]">
            <tr>
              <th className="p-3 font-bold! text-gray-900!">Nome</th>
              <th className="p-3 font-bold! text-gray-900!">CPF</th>
              <th className="p-3 font-bold! text-gray-900!">E-mail</th>
              <th className="p-3 font-bold! text-gray-900!">Responsável Pedagógico</th>
              <th className="p-3 font-bold! text-gray-900!">Papéis</th>
              <th className="p-3 font-bold! text-gray-900!">Atendimento</th>
              <th className="p-3 font-bold! text-gray-900!"></th>
            </tr>
          </thead>
          <tbody>
            {paginado?.itens.map((estudante) => (
              <tr key={estudante.id} className="border-b border-[#e4edf6] transition hover:bg-[#f7faff]">
                <td className="p-3">
                  {estudante.full_name}
                  {estudante.deleted_at && (
                    <span className="ml-2 inline-block rounded bg-red-100 px-2 py-0.5 text-xs text-red-800">
                      {textoDaExclusao(estudante.deleted_at)}
                    </span>
                  )}
                </td>
                <td className="p-3">{estudante.cpf}</td>
                <td className="p-3">{estudante.email}</td>
                <td className="p-3">{renderResponsavel(estudante)}</td>
                <td className="p-3">
                  {isAdmin ? (
                    <EditorDePapeis
                      key={`d-${estudante.id}-${estudante.roles.join(",")}`}
                      idBase={`papeis-d-${estudante.id}`}
                      nome={estudante.full_name}
                      gravado={estudante.roles}
                      legendaOculta
                      onSalvar={(papeis) => handleAlterarPapeis(estudante, papeis)}
                    />
                  ) : (
                    rotulosDosPapeis(estudante.roles).join(", ")
                  )}
                </td>
                <td className="p-3">{renderAtendimento(estudante)}</td>
                <td className="p-3">
                  <div className="flex items-center justify-center gap-2">
                    {!isAdmin && (
                      <button
                        type="button"
                        title="Mais informações"
                        onClick={() => handleVerEstudante(estudante)}
                        className="inline-flex items-center justify-center rounded-md border border-gray-200 p-2 text-gray-600 shadow-sm transition hover:bg-gray-50 hover:shadow"
                      >
                        <Eye className="w-5 h-5" />
                      </button>
                    )}
                    {!isAdmin && podeExportarRelatorio(estudante) && (
                      <button
                        type="button"
                        title="Exportar relatório"
                        onClick={() => handleExportar(estudante)}
                        className="inline-flex items-center justify-center rounded-md border border-gray-200 p-2 text-gray-600 shadow-sm transition hover:bg-gray-50 hover:shadow"
                      >
                        <FileDown className="w-5 h-5" />
                      </button>
                    )}
                    {isAdmin && podeRestaurar(user, estudante) && (
                      <button
                        type="button"
                        title="Restaurar usuário"
                        onClick={() => handleRestaurar(estudante)}
                        className="inline-flex items-center justify-center rounded-md border border-gray-200 p-2 text-gray-600 shadow-sm transition hover:bg-gray-50 hover:shadow"
                      >
                        <Undo2 className="w-5 h-5" />
                      </button>
                    )}
                    {isAdmin && !estaMarcado(estudante) && (
                      <button
                        type="button"
                        title={motivoDaLixeiraDesativada(user, estudante) ?? "Excluir usuário"}
                        disabled={!podeExcluir(user, estudante)}
                        onClick={() => handleExcluir(estudante)}
                        className="inline-flex items-center justify-center rounded-md border border-gray-200 p-2 text-red-700 shadow-sm transition hover:bg-red-50 hover:shadow disabled:cursor-not-allowed disabled:text-gray-400 disabled:hover:bg-transparent disabled:hover:shadow-none"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {filtrados?.length === 0 && (
              <tr>
                <td colSpan={totalColunas} className="p-6 text-center text-gray-600">
                  {NENHUM_ESTUDANTE}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {paginado && (
        <div className="flex flex-col gap-3 border-t border-[#dce8f4] px-5 py-4 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between sm:px-7">
          <p role="status">
            {textoDoIntervalo(
              paginado,
              isAdmin ? "usuário" : "estudante",
              isAdmin ? "usuários" : "estudantes",
            )}
          </p>
          <nav aria-label="Paginação" className="flex items-center gap-2">
            <label className="flex items-center gap-2">
              <span className="font-semibold text-gray-900">Página</span>
              <select
                value={paginado.pagina}
                onChange={(e) => setPagina(Number(e.target.value))}
                className="rounded-lg border border-[#a9c5e8] bg-white px-2 py-1 outline-none focus:border-[#006ee8] focus:ring-2 focus:ring-[#dcecff]"
              >
                {Array.from({ length: paginado.totalDePaginas }, (_, indice) => indice + 1).map((numero) => (
                  <option key={numero} value={numero}>
                    {numero}
                  </option>
                ))}
              </select>
              <span>de {paginado.totalDePaginas}</span>
            </label>
            <button
              type="button"
              aria-label="Página anterior"
              disabled={!paginado.temAnterior}
              onClick={() => setPagina(paginado.pagina - 1)}
              className="inline-flex items-center justify-center rounded border border-gray-200 p-1 text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:text-gray-300 disabled:hover:bg-transparent"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              type="button"
              aria-label="Próxima página"
              disabled={!paginado.temProxima}
              onClick={() => setPagina(paginado.pagina + 1)}
              className="inline-flex items-center justify-center rounded border border-gray-200 p-1 text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:text-gray-300 disabled:hover:bg-transparent"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </nav>
        </div>
      )}
    </div>
  );
}
