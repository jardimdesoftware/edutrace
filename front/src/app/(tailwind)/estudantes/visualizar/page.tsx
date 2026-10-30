// app/estudantes/visualizar/page.tsx

"use client";

import { useRouter } from "next/navigation";
import { rotulosDosPapeis } from "@/utils/papeis";
import AppLayout from "@/components/AppLayout";
import Loading from "@/components/Loading";
import ResponsavelPedagogico from "@/components/ResponsavelPedagogico";
import { Suspense, useState } from "react";
import { useEstudanteDaUrl } from "@/hooks/useEstudanteDaUrl";
import type { StudentData } from "@/interfaces/StudentData";
import { rotaDoEstudante } from "@/utils/estudanteDaUrl";
import { fichasDoEstudante } from "@/utils/fichasDoEstudante";
import { useAuth } from "@/contexts/AuthContext";
import {
  nomeDoResponsavel,
  podeDefinirResponsavel,
} from "@/utils/responsavelPedagogico";

const NAO_INFORMADO = "Não informado";

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
    <Suspense fallback={<Loading />}>
      <VisualizarEstudante />
    </Suspense>
  );
}

function VisualizarEstudante() {
  const { id, registro, carregando } = useEstudanteDaUrl();
  const { user } = useAuth();
  const [atualizado, setAtualizado] = useState<StudentData | null>(null);
  const estudante = atualizado?.id === registro?.id ? atualizado : registro;
  const nome = estudante?.full_name;
  const cpf = estudante?.cpf;
  const email = estudante?.email;
  const responsavel =
    estudante && podeDefinirResponsavel(user, estudante) ? (
      <ResponsavelPedagogico
        key={estudante.id}
        estudante={estudante}
        onAtualizado={setAtualizado}
      />
    ) : (
      nomeDoResponsavel(estudante)
    );
  const matricula = estudante?.enrollment_number || NAO_INFORMADO;
  const curso = estudante?.course || NAO_INFORMADO;
  const papeis = rotulosDosPapeis(estudante?.roles).join(", ") || "Papel desconhecido";

  if (carregando) {
    return <Loading />;
  }

  return (
    <AppLayout>
      <div className="p-6">
        <div className="rounded shadow bg-white">
          <div className="md:hidden p-4 space-y-2 text-sm">
            <p><span className="font-semibold">Nome:</span> {nome}</p>
            <p><span className="font-semibold">CPF:</span> {cpf}</p>
            <p className="break-all"><span className="font-semibold">E-mail:</span> {email}</p>
            <p><span className="font-semibold">Matrícula:</span> {matricula}</p>
            <p><span className="font-semibold">Curso:</span> {curso}</p>
            <p><span className="font-semibold">Responsável Pedagógico:</span> {responsavel}</p>
            <p><span className="font-semibold">Papéis:</span> {papeis}</p>
          </div>

          <div className="hidden md:block overflow-auto">
            <table className="min-w-full table-auto text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="p-3 text-left">Nome</th>
                  <th className="p-3 text-left">CPF</th>
                  <th className="p-3 text-left">E-mail</th>
                  <th className="p-3 text-left">Matrícula</th>
                  <th className="p-3 text-left">Curso</th>
                  <th className="p-3 text-left">Responsável Pedagógico</th>
                  <th className="p-3 text-left">Papéis</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t">
                  <td className="p-3">{nome}</td>
                  <td className="p-3">{cpf}</td>
                  <td className="p-3">{email}</td>
                  <td className="p-3">{matricula}</td>
                  <td className="p-3">{curso}</td>
                  <td className="p-3">{responsavel}</td>
                  <td className="p-3">{papeis}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-10 max-w-5xl mx-auto">
          {(user ? fichasDoEstudante(user.roles) : []).map((ficha) => (
            <Card key={ficha.rota} label={ficha.label} url={rotaDoEstudante(ficha.rota, id)} />
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
