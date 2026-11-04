// app/estudantes/visualizar/page.tsx

"use client";

import { useRouter } from "next/navigation";
import AppLayout from "@/components/AppLayout";
import Loading from "@/components/Loading";
import ResponsavelPedagogico from "@/components/ResponsavelPedagogico";
import CursoDoEstudante from "@/components/CursoDoEstudante";
import { podeAlterarCurso } from "@/utils/cursos";
import { Suspense, useState, type ReactNode } from "react";
import { useEstudanteDaUrl } from "@/hooks/useEstudanteDaUrl";
import type { StudentData } from "@/interfaces/StudentData";
import { rotaDoEstudante } from "@/utils/estudanteDaUrl";
import { fichasDoEstudante } from "@/utils/fichasDoEstudante";
import { useAuth } from "@/contexts/AuthContext";
import {
  nomeDoResponsavel,
  podeDefinirResponsavel,
} from "@/utils/responsavelPedagogico";
import { ArrowRight } from "lucide-react";

const NAO_INFORMADO = "Não informado";

const DESCRICAO_DA_FICHA: Record<string, string> = {
  Triagem: "Informações iniciais e necessidades identificadas.",
  Anamnese: "Histórico e contexto do estudante.",
  "Estudo de Caso": "Análise educacional integrada.",
  PAEE: "Plano de atendimento educacional especializado.",
  "Anotações Multiprofissionais": "Registros compartilhados pela equipe.",
  PEI: "Plano Educacional Individualizado.",
};

function Card({ label, url }: { label: string, url: string }) {
  const router = useRouter();

  return (
    <button
      type="button"
      className="group flex min-h-40 flex-col rounded-2xl border border-[#dce8f4] bg-white p-5 text-left shadow-[0_8px_24px_rgba(28,67,112,0.07)] transition hover:-translate-y-0.5 hover:border-[#9cc8f5] hover:shadow-[0_14px_30px_rgba(28,67,112,0.12)] focus:outline-none focus:ring-4 focus:ring-[#b8dcff]"
      onClick={() => router.push(url)}
    >
      <span className="font-bold text-[#0b2455]">{label}</span>
      <span className="mt-2 text-sm leading-5 text-slate-600">
        {DESCRICAO_DA_FICHA[label] ?? "Consultar informações do estudante."}
      </span>
      <span className="mt-auto inline-flex items-center gap-1 pt-4 text-sm font-bold text-[#006ee8]">
        Acessar <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
      </span>
    </button>
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
  const curso: ReactNode =
    estudante && podeAlterarCurso(user, estudante) ? (
      <CursoDoEstudante
        key={`${estudante.id}-${estudante.course ?? ""}`}
        estudante={estudante}
        onAtualizado={setAtualizado}
      />
    ) : (
      estudante?.course || NAO_INFORMADO
    );

  if (carregando) {
    return <Loading />;
  }

  return (
    <AppLayout>
      <div className="mx-auto w-full max-w-[1500px] p-5 sm:p-7 lg:p-10">
        <section aria-labelledby="dados-estudante-titulo" className="rounded-2xl border border-[#dce8f4] bg-white/95 p-5 shadow-[0_14px_40px_rgba(28,67,112,0.08)] sm:p-6">
          <h1 id="dados-estudante-titulo" className="edutrace-page-title">Dados do estudante</h1>
          <p className="mt-1.5 text-sm leading-5 text-slate-600">
            Informações de identificação e acompanhamento de {nome || "estudante"}.
          </p>

          <dl className="mt-5 grid gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
            {([
              ["Nome", nome],
              ["CPF", cpf],
              ["E-mail", email],
              ["Matrícula", matricula],
              ["Curso", curso],
              ["Responsável pedagógico", responsavel],
            ] satisfies [string, ReactNode][]).map(([rotulo, valor]) => (
              <div key={rotulo} className="min-w-0 border-b border-[#e5edf6] pb-3">
                <dt className="text-xs font-bold uppercase tracking-[0.08em] text-slate-500">{rotulo}</dt>
                <dd className="mt-1 break-words text-sm font-medium text-[#17233f]">{valor || NAO_INFORMADO}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section aria-labelledby="registros-estudante-titulo" className="mt-8">
          <h2 id="registros-estudante-titulo">Registros e planos</h2>
          <p className="mt-1.5 text-sm leading-5 text-slate-600">
            Selecione uma área para consultar ou atualizar as informações disponíveis.
          </p>
          <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {(user ? fichasDoEstudante(user.roles) : []).map((ficha) => (
            <Card key={ficha.rota} label={ficha.label} url={rotaDoEstudante(ficha.rota, id)} />
          ))}
          </div>
        </section>
      </div>
    </AppLayout>
  );
}
