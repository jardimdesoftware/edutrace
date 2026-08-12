// app/estudantes/visualizar/page.tsx

"use client";

import { useSearchParams, useRouter } from "next/navigation";
import AppLayout from "@/components/AppLayout";
import { Suspense } from "react";

function Card({ label, url }: { label: string, url: string }) {
  const router = useRouter();

  return (
    <div
      className="relative bg-white rounded-lg shadow-md p-8 flex flex-col items-center justify-center text-center cursor-pointer transition hover:shadow-lg"
      onClick={() => router.push(url)}
    >
      <span className="text-green-900 font-semibold text-lg leading-tight">{label}</span>
    </div>
  );
}

export default function VisualizarPageWrapper() {
  return (
    <Suspense fallback={<div>Carregando...</div>}>
      <VisualizarEstudante />
    </Suspense>
  );
}

function VisualizarEstudante() {
  const searchParams = useSearchParams();
  const nome = searchParams.get("nome");
  const cpf = searchParams.get("cpf");
  const email = searchParams.get("email");
  const responsavel = searchParams.get("responsavel");
  const id = searchParams.get("id");
  const nivelAcesso = searchParams.get("nivelAcesso")

  function getLevelName(id_level: string | null) {
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
    <AppLayout>
      <div className="p-6">
        <div className="rounded shadow bg-white">
          <div className="md:hidden p-4 space-y-2 text-sm">
            <p><span className="font-semibold">Nome:</span> {nome}</p>
            <p><span className="font-semibold">CPF:</span> {cpf}</p>
            <p className="break-all"><span className="font-semibold">E-mail:</span> {email}</p>
            <p><span className="font-semibold">Responsável Pedagógico:</span> {responsavel === "null" ? "Responsável não atribuído" : responsavel }</p>
            <p><span className="font-semibold">Nível de Acesso:</span> {getLevelName(nivelAcesso)}</p>
          </div>

          <div className="hidden md:block overflow-auto">
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
                  <td className="p-3">{getLevelName(nivelAcesso)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-10 max-w-5xl mx-auto">
          <Card label="Triagem" url={`/triagem?email=${email}&nome=${nome}`} />
          <Card label="Anamnese" url={`/anamnese?email=${email}&nome=${nome}`} />
          <Card label="Comentários Multiprofissionais" url={`/comentarios?id=${id}&email=${email}&nome=${nome}`}/>
          <Card label="PEI" url={`/pei?email=${email}&nome=${nome}`} />
        </div>
      </div>
    </AppLayout>
  );
}
