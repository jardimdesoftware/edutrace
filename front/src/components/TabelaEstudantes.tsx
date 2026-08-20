// components/TabelaEstudantes.tsx

"use client";

import { getAllStudents } from "@/api/students";
import { updateUser } from "@/api/user";
import { ADMIN } from "@/consts";
import { useAuth } from "@/contexts/AuthContext";
import { StudentData } from "@/interfaces/StudentData";
import { exportStudentReportXlsx } from "@/lib/exportStudentReport";
import { Eye, FileDown, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Swal from "sweetalert2";
import Loading from "./Loading";

export default function TabelaEstudantes() {
  const [busca, setBusca] = useState("");
  const router = useRouter();
  const [ students, setStudents ] = useState<StudentData[] | null>(null);
  const { user, loading } = useAuth();

  const isAdmin = user?.id_level === ADMIN;

  const filtrados = students?.filter(e =>
    e.full_name.toLowerCase().includes(busca.toLowerCase())
  );

  const handleVerEstudante = (estudante: StudentData) => {
    const nome = estudante.full_name;
    const cpf = estudante.cpf;
    const email = estudante.email;
    const responsavel = estudante.pedagogical_manager;
    const id = estudante.id;
    const id_level = estudante.id_level

    router.push(`/estudantes/visualizar?id=${id}&nome=${nome}&cpf=${cpf}&email=${email}&responsavel=${responsavel}&nivelAcesso=${id_level}`);
  };

  const handleExportar = async (email: string) => {
    try {
      const resultado = await exportStudentReportXlsx(email);
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

  const handleAlterarNivel = async (estudante: StudentData, novoNivel: string) => {
    const confirmacao = await Swal.fire({
      icon: "warning",
      title: "Alterar nível de acesso",
      text: `Tem certeza que deseja alterar o nível de acesso para "${getLevelName(Number(novoNivel))}"?`,
      showCancelButton: true,
      confirmButtonColor: "#047857",
      cancelButtonColor: "#6b7280",
      confirmButtonText: "Sim, alterar",
      cancelButtonText: "Cancelar",
    });

    if (!confirmacao.isConfirmed) return;

    try {
      await updateUser(estudante.email, novoNivel);
      setStudents((prev) =>
        prev
          ? prev.map((e) =>
              e.email === estudante.email ? { ...e, id_level: Number(novoNivel) } : e,
            )
          : prev,
      );
      Swal.fire({
        icon: "success",
        title: "Nível de acesso atualizado com sucesso!",
        confirmButtonColor: "#047857",
        confirmButtonText: "Ok",
      });
    } catch (error) {
      console.error(error);
      Swal.fire({
        icon: "error",
        title: "Falha ao atualizar o nível de acesso",
        confirmButtonColor: "#047857",
        confirmButtonText: "Entendi",
      });
    }
  };

  useEffect(() => {
    async function fetchData() {
      try {
        const data = await getAllStudents();
        setStudents(data);
      } catch (error) {
        console.error("Erro ao buscar estudantes", error);
      }
    }
    fetchData();
  }, []);

  function getLevelName(id_level: number) {
    switch(id_level) {
      case 1:
        return "Admin";
      case 2:
        return "Estudante/Família";
      case 3:
        return "Profissional da Educação";
      case 4:
        return "Profissional da Saúde";
      default:
        return "Nível desconhecido";
    }
  }

  if (loading) return <Loading fullScreen={false} />;

  return (
    <div className="bg-white rounded shadow-md">
      <div className="p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {isAdmin && (
          <button
            type="button"
            onClick={() => router.push("/admin/usuarios/cadastro")}
            className="inline-flex items-center justify-center gap-2 rounded bg-emerald-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-800"
          >
            <UserPlus className="w-4 h-4" />
            Cadastrar novas pessoas
          </button>
        )}
        <input
          type="text"
          placeholder="Por quem você busca?"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="w-full sm:w-80 border rounded px-3 py-2 sm:ml-auto"
        />
      </div>

      <div className="md:hidden px-4 pb-4 space-y-3">
        {filtrados?.map((estudante, index) => (
          <div key={index} className="border rounded-lg p-4 shadow-sm">
            <div className="space-y-1 text-sm">
              <p><span className="font-semibold">Nome:</span> {estudante.full_name}</p>
              <p><span className="font-semibold">CPF:</span> {estudante.cpf}</p>
              <p className="break-all"><span className="font-semibold">E-mail:</span> {estudante.email}</p>
              <p><span className="font-semibold">Responsável Pedagógico:</span> {estudante.pedagogical_manager}</p>
              {isAdmin ? (
                <div className="flex items-center gap-2">
                  <span className="font-semibold">Nível de Acesso:</span>
                  <select
                    className="border rounded px-2 py-1"
                    value={String(estudante.id_level)}
                    onChange={(e) => handleAlterarNivel(estudante, e.target.value)}
                  >
                    <option value="1">Admin</option>
                    <option value="2">Estudante/Família</option>
                    <option value="3">Profissional da Educação</option>
                    <option value="4">Profissional da Saúde</option>
                  </select>
                </div>
              ) : (
                <p><span className="font-semibold">Nível de Acesso:</span> {getLevelName(estudante.id_level)}</p>
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
              <button
                onClick={() => handleExportar(estudante.email)}
                title="Exportar relatório"
                className="flex-1 inline-flex items-center justify-center gap-2 rounded border px-3 py-2 text-sm text-gray-700 shadow-sm hover:bg-gray-50 hover:shadow"
              >
                <FileDown className="w-4 h-4" />
                Exportar
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="hidden md:block overflow-x-auto">
        <table className="min-w-full table-auto text-sm text-left">
          <thead className="bg-gray-100 text-gray-700">
            <tr>
              <th className="p-3">Nome</th>
              <th className="p-3">CPF</th>
              <th className="p-3">E-mail</th>
              <th className="p-3">Responsável Pedagógico</th>
              <th className="p-3">Nível de Acesso</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {filtrados?.map((estudante, index) => (
              <tr key={index} className="border-b hover:bg-gray-50">
                <td className="p-3">{estudante.full_name}</td>
                <td className="p-3">{estudante.cpf}</td>
                <td className="p-3">{estudante.email}</td>
                <td className="p-3">{estudante.pedagogical_manager}</td>
                <td className="p-3">
                  {isAdmin ? (
                    <select
                      className="border rounded px-2 py-1"
                      value={String(estudante.id_level)}
                      onChange={(e) => handleAlterarNivel(estudante, e.target.value)}
                    >
                      <option value="1">Admin</option>
                      <option value="2">Estudante/Família</option>
                      <option value="3">Profissional da Educação</option>
                      <option value="4">Profissional da Saúde</option>
                    </select>
                  ) : (
                    getLevelName(estudante.id_level)
                  )}
                </td>
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
                    <button
                      type="button"
                      title="Exportar relatório"
                      onClick={() => handleExportar(estudante.email)}
                      className="inline-flex items-center justify-center rounded-md border border-gray-200 p-2 text-gray-600 shadow-sm transition hover:bg-gray-50 hover:shadow"
                    >
                      <FileDown className="w-5 h-5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
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
