// app/configuracao/page.tsx

"use client";

import { useSearchParams, useRouter } from "next/navigation";
import AppLayout from "@/components/AppLayout";
import { Suspense } from "react";
import { updateUser } from "@/api/user";

export default function VisualizarPageWrapper() {
  return (
    <Suspense fallback={<div>Carregando...</div>}>
      <VisualizarEstudanteConfig />
    </Suspense>
  );
}

function VisualizarEstudanteConfig() {
  const searchParams = useSearchParams();
  const nome = searchParams.get("nome");
  const cpf = searchParams.get("cpf");
  const email = searchParams.get("email");
  const responsavel = searchParams.get("responsavel");
  const nivelAcesso = searchParams.get("nivelAcesso")
  const router = useRouter();
  
  function getLevelName(id_level: string) {
    switch(id_level) {
      case '1':
        return "Admin";
      case '2':
        return "Estudante/Família";
      case '3':
        return "Profissional da Educação";
      case '4':
        return "Profissional da Saúde";
      default:
        return "Nível desconhecido";
    }
  }

  return (
    <AppLayout
    >
      <div className="p-6">
        <div className="overflow-auto rounded shadow">
          <table className="min-w-full table-auto text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-3 text-left">Nome</th>
                <th className="p-3 text-left">CPF</th>
                <th className="p-3 text-left">E-mail</th>
                <th className="p-3 text-left">Responsável Pedagógico</th>
                <th className="p-3 text-left">Nível de Acesso</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t">
                <td className="p-3">{nome}</td>
                <td className="p-3">{cpf}</td>
                <td className="p-3">{email}</td>
                <td className="p-3">{responsavel === "null" ? "Responsável não atribuído" : responsavel }</td>
                <td className="p-3">
                    <select
                        className="border rounded px-2 py-1"
                        value={nivelAcesso ? nivelAcesso: undefined}
                        onChange={async (e) => {
                        const novoNivel = e.target.value;

                        const confirmUpdate = window.confirm(
                            `Tem certeza que deseja alterar o nível de acesso para "${getLevelName(novoNivel)}"?`
                        );
                        
                        if (!confirmUpdate) return;

                        try {
                            if (email) {
                              await updateUser(email, novoNivel)
                            }
                            router.push('/estudantes')
                            alert("Nível de acesso atualizado com sucesso!");
                        } catch (err) {
                            console.error(err);
                            alert("Falha ao atualizar o nível de acesso");
                        }
                        }}
                    >
                        <option value="1">Admin</option>
                        <option value="2">Estudante/Família</option>
                        <option value="3">Profissional da Educação</option>
                        <option value="4">Profissional da Saúde</option>
                    </select>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </AppLayout>
  );
}
