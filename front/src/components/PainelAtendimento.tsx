"use client";

import { getServiceStats } from "@/api/serviceStats";
import type { ServiceStatus } from "@/interfaces/StudentData";
import {
  montarPainel,
  type OcupacaoDoProfissional,
  type PainelDeAtendimento,
  type SituacaoDoProfissional,
  type TotalDoPainel,
} from "@/utils/estatisticasAtendimento";
import { TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import Loading from "./Loading";

type Estado =
  | { tipo: "carregando" }
  | { tipo: "erro" }
  | { tipo: "pronto"; painel: PainelDeAtendimento };

// Mesmas cores do selo de status da tabela de estudantes. A cor só identifica
// o status ao lado do rótulo, que sempre aparece em texto.
const PONTO_DO_STATUS: Record<ServiceStatus, string> = {
  WAITING: "bg-amber-500",
  IN_SERVICE: "bg-emerald-600",
  CLOSED: "bg-gray-400",
};

// O preenchimento da barra segue a situação; o trilho é um tom mais claro da
// mesma cor, para a barra inteira indicar a situação.
const ESTILO_DA_SITUACAO: Record<
  SituacaoDoProfissional,
  { selo: string; preenchimento: string; trilho: string; linha: string }
> = {
  COM_VAGAS: {
    selo: "border-emerald-300 bg-emerald-100 text-emerald-900",
    preenchimento: "bg-emerald-600",
    trilho: "bg-emerald-100",
    linha: "",
  },
  NO_LIMITE: {
    selo: "border-amber-300 bg-amber-100 text-amber-900",
    preenchimento: "bg-amber-500",
    trilho: "bg-amber-100",
    linha: "bg-amber-50",
  },
  SEM_LIMITE: {
    selo: "border-gray-300 bg-gray-100 text-gray-800",
    preenchimento: "bg-gray-400",
    trilho: "bg-gray-200",
    linha: "",
  },
};

function Totais({ totais }: { totais: TotalDoPainel[] }) {
  return (
    <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {totais.map(({ status, rotulo, valor, detalhe }) => (
        <div key={status} className="rounded-lg border border-gray-200 p-4">
          <dt className="flex items-center gap-2 text-sm text-gray-700">
            <span
              aria-hidden="true"
              className={`h-2.5 w-2.5 rounded-full ${PONTO_DO_STATUS[status]}`}
            />
            {rotulo}
          </dt>
          <dd className="mt-1 text-3xl font-semibold text-gray-900">{valor}</dd>
          {detalhe && <dd className="mt-1 text-xs text-gray-700">{detalhe}</dd>}
        </div>
      ))}
    </dl>
  );
}

function LinhaDoProfissional({ profissional }: { profissional: OcupacaoDoProfissional }) {
  const estilo = ESTILO_DA_SITUACAO[profissional.situacao];

  return (
    <tr className={`border-b ${estilo.linha}`}>
      <td>
        <span className="font-medium text-gray-900">{profissional.nome}</span>
      </td>
      <td>
        <span className="text-gray-900">{profissional.ocupacao}</span>
        {profissional.percentual !== null && (
          <div
            aria-hidden="true"
            className={`mt-1 h-1.5 w-28 overflow-hidden rounded-full ${estilo.trilho}`}
          >
            <div
              className={`h-full rounded-full ${estilo.preenchimento}`}
              style={{ width: `${profissional.percentual}%` }}
            />
          </div>
        )}
      </td>
      <td>
        <span className="text-gray-900">{profissional.vagas}</span>
      </td>
      <td>
        <span
          className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs font-medium ${estilo.selo}`}
        >
          {profissional.situacao === "NO_LIMITE" && (
            <TriangleAlert className="h-3 w-3" aria-hidden="true" />
          )}
          {profissional.rotuloSituacao}
        </span>
      </td>
    </tr>
  );
}

function Profissionais({ profissionais }: { profissionais: OcupacaoDoProfissional[] }) {
  if (profissionais.length === 0) {
    return <div className="mt-6 text-sm text-gray-700">Nenhum profissional NAPNE cadastrado.</div>;
  }

  return (
    <div className="mt-6 overflow-x-auto">
      <table className="min-w-full table-auto text-sm text-left">
        <caption className="mb-2 text-left text-base font-semibold text-gray-900">
          Profissionais NAPNE
        </caption>
        <thead className="bg-gray-100 text-gray-700">
          <tr>
            <th scope="col">Profissional</th>
            <th scope="col">Ocupação</th>
            <th scope="col">Vagas livres</th>
            <th scope="col">Situação</th>
          </tr>
        </thead>
        <tbody>
          {profissionais.map((profissional) => (
            <LinhaDoProfissional key={profissional.id} profissional={profissional} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface PainelAtendimentoProps {
  versao: number;
}

export default function PainelAtendimento({ versao }: PainelAtendimentoProps) {
  const [estado, setEstado] = useState<Estado>({ tipo: "carregando" });

  useEffect(() => {
    let ativo = true;

    async function carregar() {
      try {
        const estatisticas = await getServiceStats();
        if (ativo) {
          setEstado({ tipo: "pronto", painel: montarPainel(estatisticas, new Date()) });
        }
      } catch (error) {
        console.error("Erro ao buscar estatísticas de atendimento", error);
        if (ativo) setEstado({ tipo: "erro" });
      }
    }
    carregar();

    return () => {
      ativo = false;
    };
  }, [versao]);

  return (
    <section
      aria-labelledby="painel-atendimento-titulo"
      className="mb-6 rounded bg-white p-4 shadow-md"
    >
      <h2 id="painel-atendimento-titulo" className="mb-4 text-xl font-semibold text-gray-900">
        Estatísticas de atendimento
      </h2>
      {estado.tipo === "carregando" && (
        <Loading fullScreen={false} label="Carregando estatísticas..." />
      )}
      {estado.tipo === "erro" && (
        <div
          role="alert"
          className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          Não foi possível carregar as estatísticas de atendimento.
        </div>
      )}
      {estado.tipo === "pronto" && (
        <>
          <Totais totais={estado.painel.totais} />
          <Profissionais profissionais={estado.painel.profissionais} />
        </>
      )}
    </section>
  );
}
