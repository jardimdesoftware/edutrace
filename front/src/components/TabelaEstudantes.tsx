// components/TabelaEstudantes.tsx

"use client";

import {
  assumirAtendimento,
  encerrarAtendimento,
  getStudentByEmail,
} from "@/api/students";
import { updateUser } from "@/api/user";
import { ADMIN } from "@/consts";
import { useAuth } from "@/contexts/AuthContext";
import { StudentData } from "@/interfaces/StudentData";
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
  rotulosDosPapeis,
  temPapel,
} from "@/utils/papeis";
import { rotaDoEstudante } from "@/utils/estudanteDaUrl";
import { canAccessPage } from "@/utils/pageAccess";
import {
  listarUsuariosDaTabela,
  podeExportarRelatorio,
  responsavelDaLinha,
  substituirUsuario,
} from "@/utils/tabelaUsuarios";
import { Eye, FileDown, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Swal from "sweetalert2";
import AtendimentoEstudante from "./AtendimentoEstudante";
import Loading from "./Loading";
import EditorDePapeis from "./EditorDePapeis";

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

interface TabelaEstudantesProps {
  onAlteracao?: () => void;
}

export default function TabelaEstudantes({ onAlteracao }: TabelaEstudantesProps) {
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>("TODOS");
  const [acaoEmAndamento, setAcaoEmAndamento] = useState(false);
  const router = useRouter();
  const [ students, setStudents ] = useState<StudentData[] | null>(null);
  const { user, loading } = useAuth();

  const isAdmin = temPapel(user?.roles, ADMIN);
  const podeCadastrar = !!user && canAccessPage("/admin/usuarios/cadastro", user.roles);
  const totalColunas = 7;

  const filtrados = students && filtrarPorStatus(
    students.filter(e => e.full_name.toLowerCase().includes(busca.toLowerCase())),
    filtroStatus,
  );

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
      onAlteracao?.();
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
      onAlteracao?.();
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
      onAlteracao?.();
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

  return (
    <div className="bg-white rounded shadow-md">
      <div className="p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {podeCadastrar && (
          <button
            type="button"
            onClick={() => router.push("/admin/usuarios/cadastro")}
            className="inline-flex items-center justify-center gap-2 rounded bg-emerald-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-800"
          >
            <UserPlus className="w-4 h-4" />
            Cadastrar novas pessoas
          </button>
        )}
        <div className="flex flex-col gap-3 sm:ml-auto sm:flex-row sm:items-center">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <span className="font-semibold">Atendimento:</span>
            <select
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value as FiltroStatus)}
              className="border rounded px-2 py-2"
            >
              {OPCOES_FILTRO_STATUS.map((opcao) => (
                <option key={opcao.value} value={opcao.value}>
                  {opcao.label}
                </option>
              ))}
            </select>
          </label>
          <input
            type="text"
            placeholder="Por quem você busca?"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full sm:w-80 border rounded px-3 py-2"
          />
        </div>
      </div>

      {students && (
        <p role="status" className="px-4 pb-3 text-sm text-gray-700">
          {textoDaContagem(contarPorStatus(students))}
        </p>
      )}

      <div className="md:hidden px-4 pb-4 space-y-3">
        {filtrados?.map((estudante) => (
          <div key={estudante.id} className="border rounded-lg p-4 shadow-sm">
            <div className="space-y-1 text-sm">
              <p><span className="font-semibold">Nome:</span> {estudante.full_name}</p>
              <p><span className="font-semibold">CPF:</span> {estudante.cpf}</p>
              <p className="break-all"><span className="font-semibold">E-mail:</span> {estudante.email}</p>
              <p><span className="font-semibold">Responsável Pedagógico:</span> {responsavelDaLinha(estudante)}</p>
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
              <button
                onClick={() => handleVerEstudante(estudante)}
                title="Mais informações"
                className="flex-1 inline-flex items-center justify-center gap-2 rounded border px-3 py-2 text-sm text-gray-700 shadow-sm hover:bg-gray-50 hover:shadow"
              >
                <Eye className="w-4 h-4" />
                Visualizar
              </button>
              {podeExportarRelatorio(estudante) && (
                <button
                  onClick={() => handleExportar(estudante)}
                  title="Exportar relatório"
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded border px-3 py-2 text-sm text-gray-700 shadow-sm hover:bg-gray-50 hover:shadow"
                >
                  <FileDown className="w-4 h-4" />
                  Exportar
                </button>
              )}
            </div>
          </div>
        ))}
        {filtrados?.length === 0 && (
          <p className="py-4 text-center text-sm text-gray-600">{NENHUM_ESTUDANTE}</p>
        )}
      </div>

      <div className="hidden md:block overflow-x-auto">
        <table className="min-w-full table-auto text-sm text-left">
          <thead className="bg-gray-100 text-gray-700">
            <tr>
              <th className="p-3">Nome</th>
              <th className="p-3">CPF</th>
              <th className="p-3">E-mail</th>
              <th className="p-3">Responsável Pedagógico</th>
              <th className="p-3">Papéis</th>
              <th className="p-3">Atendimento</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {filtrados?.map((estudante) => (
              <tr key={estudante.id} className="border-b hover:bg-gray-50">
                <td className="p-3">{estudante.full_name}</td>
                <td className="p-3">{estudante.cpf}</td>
                <td className="p-3">{estudante.email}</td>
                <td className="p-3">{responsavelDaLinha(estudante)}</td>
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
                    <button
                      type="button"
                      title="Mais informações"
                      onClick={() => handleVerEstudante(estudante)}
                      className="inline-flex items-center justify-center rounded-md border border-gray-200 p-2 text-gray-600 shadow-sm transition hover:bg-gray-50 hover:shadow"
                    >
                      <Eye className="w-5 h-5" />
                    </button>
                    {podeExportarRelatorio(estudante) && (
                      <button
                        type="button"
                        title="Exportar relatório"
                        onClick={() => handleExportar(estudante)}
                        className="inline-flex items-center justify-center rounded-md border border-gray-200 p-2 text-gray-600 shadow-sm transition hover:bg-gray-50 hover:shadow"
                      >
                        <FileDown className="w-5 h-5" />
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

      <div className="flex justify-between items-center px-4 py-3 text-sm text-gray-600 border-t">
        <div>Exibir <span className="font-semibold">{students?.length}</span> de 100 itens</div>
        <div className="flex items-center space-x-2">
          <span>Página</span>
          <select className="border rounded px-2 py-1">
            <option>1</option>
            {/* outras opções aqui */}
          </select>
          <button>{"<"}</button>
          <button>{">"}</button>
        </div>
      </div>
    </div>
  );
}
