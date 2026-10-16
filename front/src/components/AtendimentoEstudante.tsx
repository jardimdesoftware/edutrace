"use client";

import { ServiceStatus, StudentData } from "@/interfaces/StudentData";
import { rotuloDoResponsavel, rotuloDoStatus } from "@/utils/atendimento";

// A cor só reforça o rótulo, que sempre aparece em texto.
const COR_DO_STATUS: Record<ServiceStatus, string> = {
  WAITING: "bg-amber-100 text-amber-900 border-amber-300",
  IN_SERVICE: "bg-emerald-100 text-emerald-900 border-emerald-300",
  CLOSED: "bg-gray-100 text-gray-800 border-gray-300",
};

const BOTAO_ACAO =
  "rounded border px-2 py-1 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60";

interface AtendimentoEstudanteProps {
  estudante: StudentData;
  podeAssumir: boolean;
  podeEncerrar: boolean;
  ocupado: boolean;
  onAssumir: () => void;
  onEncerrar: () => void;
}

export default function AtendimentoEstudante({
  estudante,
  podeAssumir,
  podeEncerrar,
  ocupado,
  onAssumir,
  onEncerrar,
}: AtendimentoEstudanteProps) {
  const status = estudante.service_status;
  if (!status) return null;

  return (
    <div className="flex flex-col items-start gap-1">
      <span
        className={`inline-block rounded border px-2 py-0.5 text-xs font-medium ${COR_DO_STATUS[status]}`}
      >
        {rotuloDoStatus(status)}
      </span>
      {estudante.napne_responsible && (
        <span className="text-xs text-gray-700">
          {rotuloDoResponsavel(status)}: {estudante.napne_responsible.full_name}
        </span>
      )}
      {podeAssumir && (
        <button
          type="button"
          disabled={ocupado}
          onClick={onAssumir}
          aria-label={`Assumir atendimento de ${estudante.full_name}`}
          className={BOTAO_ACAO}
        >
          Assumir
        </button>
      )}
      {podeEncerrar && (
        <button
          type="button"
          disabled={ocupado}
          onClick={onEncerrar}
          aria-label={`Encerrar atendimento de ${estudante.full_name}`}
          className={BOTAO_ACAO}
        >
          Encerrar
        </button>
      )}
    </div>
  );
}
