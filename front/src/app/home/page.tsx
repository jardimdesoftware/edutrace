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
import { useAuth } from "@/contexts/AuthContext";
import { ESTUDANTE } from "@/consts";
import { Suspense } from "react";

export default function HomePageWrapper() {
  return (
    <Suspense fallback={<div>Carregando...</div>}>
      <HomePage />
    </Suspense>
  );
}

function HomePage() {
  const { user, loading } = useAuth();

  if (loading || !user) {
    return <div>Carregando...</div>;
  }

  const isStudent = user.id_level === ESTUDANTE;

  return (
    <AppLayout showBack={false}>
      <main className="p-6">
        {isStudent ? (
          <>
            <h1 className="text-3xl font-light mb-6">Página inicial</h1>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              <HomeCard label="Triagem" icon={ClipboardPlus} href="/triagem" />
              <HomeCard label="Anamnese" icon={Stethoscope} href="/anamnese" />
              <HomeCard label="Comentários Multiprofissionais" icon={MessagesSquare} href="/comentarios" />
              <HomeCard label="PEI" icon={BookOpenCheck} href="/pei" />
            </div>
          </>
        ) : (
          <TabelaEstudantes />
        )}
      </main>
    </AppLayout>
  );
}
