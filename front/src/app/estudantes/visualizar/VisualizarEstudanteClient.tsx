"use client";

import { useSearchParams } from "next/navigation";
import AppLayout from "@/components/AppLayout";
import {
  ClipboardPlus,
  Stethoscope,
  MessagesSquare,
  BookOpenCheck,
  FileText,
  CheckCircle,
  AlertTriangle,
  Info,
} from "lucide-react";
import { JSX } from "react";

function Card({
  label,
  icon: Icon,
  status,
}: {
  label: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  status?: "ok" | "warn" | "info";
}) {
  const statusIcons: Record<"ok" | "warn" | "info", JSX.Element> = {
    ok: <CheckCircle className="text-green-500 absolute top-2 right-2" />,
    warn: <AlertTriangle className="text-yellow-500 absolute top-2 right-2" />,
    info: <Info className="text-blue-500 absolute top-2 right-2" />,
  };

  return (
    <div className="relative bg-white rounded shadow p-6 flex flex-col items-center justify-center text-center hover:shadow-md">
      {status && statusIcons[status]}
      <Icon className="w-8 h-8 mb-2 text-green-800" />
      <span className="text-green-900 font-medium text-sm leading-tight">{label}</span>
    </div>
  );
}

export default function VisualizarEstudanteClient() {
  const searchParams = useSearchParams();
  const nome = searchParams.get("nome");
  const cpf = searchParams.get("cpf");
  const email = searchParams.get("email");
  const responsavel = searchParams.get("responsavel");
  const endereco = searchParams.get("endereco");

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
                <th className="p-3 text-left">Endereço</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t">
                <td className="p-3">{nome}</td>
                <td className="p-3">{cpf}</td>
                <td className="p-3">{email}</td>
                <td className="p-3">{responsavel}</td>
                <td className="p-3">{endereco}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-10">
          <Card label="Triagem" icon={ClipboardPlus} status="ok" />
          <Card label="Anamnese" icon={Stethoscope} status="warn" />
          <Card
            label="Comentários Multiprofissionais"
            icon={MessagesSquare}
            status="info"
          />
          <Card label="PEI" icon={BookOpenCheck} />
          <Card label="Relatórios" icon={FileText} />
        </div>
      </div>
    </AppLayout>
  );
}
