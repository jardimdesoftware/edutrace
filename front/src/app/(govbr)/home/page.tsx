"use client";

import "@govbr-ds/core/dist/core.min.css";
import AppLayout from "@/components/AppLayout";
import {
  ClipboardPlus,
  Stethoscope,
  MessagesSquare,
  BookOpenCheck,
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

  const conteudo = conteudoDaHome(user.id_level);

  return (
    <AppLayout showBack={false}>
      <main className="p-6">
        {conteudo === "estudante" && (
          <>
            <h1 className="text-3xl font-light mb-6">Página inicial</h1>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              <HomeCard label="Triagem" icon={ClipboardPlus} href="/triagem" />
              <HomeCard label="Anamnese" icon={Stethoscope} href="/anamnese" />
              <HomeCard label="Anotações Multiprofissionais" icon={MessagesSquare} href="/comentarios" />
              <HomeCard label="PEI" icon={BookOpenCheck} href="/pei" />
            </div>
          </>
        )}
        {conteudo === "profissional" && <TabelaEstudantes />}
        {conteudo === "sem-perfil" && (
          <>
            <h1 className="text-3xl font-light mb-6">Página inicial</h1>
            <p>Seu perfil de acesso ainda não tem telas disponíveis. Procure a administração do sistema.</p>
          </>
        )}
      </main>
    </AppLayout>
  );
}
