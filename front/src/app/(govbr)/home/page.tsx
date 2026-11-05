"use client";

import "@govbr-ds/core/dist/core.min.css";
import AppLayout from "@/components/AppLayout";
import {
  ClipboardPlus,
  Stethoscope,
  MessagesSquare,
  BookOpenCheck,
  FileUser,
  ClipboardList,
} from 'lucide-react';
import HomeCard from "@/components/HomeCard";
import TabelaEstudantes from "@/components/TabelaEstudantes";
import Loading from "@/components/Loading";
import { useAuth } from "@/contexts/AuthContext";
import { conteudoDaHome } from "@/utils/pageAccess";
import { Suspense } from "react";

export default function HomePageWrapper() {
  return (
    <Suspense fallback={<Loading />}>
      <HomePage />
    </Suspense>
  );
}

function HomePage() {
  const { user, loading } = useAuth();

  if (loading || !user) {
    return <Loading />;
  }

  const conteudo = conteudoDaHome(user.roles);

  return (
    <AppLayout showBack={false}>
      <main className="mx-auto w-full max-w-[1500px] p-5 sm:p-7 lg:p-10">
        {conteudo === "estudante" && (
          <>
            <section aria-labelledby="inicio-estudante-titulo">
              <h1 id="inicio-estudante-titulo" className="edutrace-page-title">Página inicial</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 sm:text-base">
                Consulte seus registros e acompanhe as informações do atendimento educacional.
              </p>
            </section>
            <nav aria-label="Registros do estudante" className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              <HomeCard label="Triagem" description="Consulte as informações iniciais do atendimento." icon={ClipboardPlus} href="/triagem" />
              <HomeCard label="Anamnese" description="Acesse o histórico e as informações de contexto." icon={Stethoscope} href="/anamnese" />
              <HomeCard label="Estudo de Caso" description="Acompanhe a análise educacional integrada." icon={FileUser} href="/estudo-de-caso" />
              <HomeCard label="PAEE" description="Consulte o plano de atendimento educacional especializado." icon={ClipboardList} href="/paee" />
              <HomeCard label="Anotações Multiprofissionais" description="Veja os registros realizados pela equipe de atendimento." icon={MessagesSquare} href="/comentarios" />
              <HomeCard label="PEI" description="Acompanhe o Plano Educacional Individualizado." icon={BookOpenCheck} href="/pei" />
            </nav>
          </>
        )}
        {conteudo === "profissional" && (
          <>
            <TabelaEstudantes />
          </>
        )}
        {conteudo === "administrador" && <TabelaEstudantes />}
        {conteudo === "sem-perfil" && (
          <>
            <h1 className="edutrace-page-title">Página inicial</h1>
            <p className="mt-2 text-slate-600">Seu perfil de acesso ainda não tem telas disponíveis. Procure a administração do sistema.</p>
          </>
        )}
      </main>
    </AppLayout>
  );
}
