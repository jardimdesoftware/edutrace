"use client";

import "@govbr-ds/core/dist/core.min.css";
import AppLayout from "@/components/AppLayout";
import {
  Users,
  ClipboardPlus,
  Stethoscope,
  MessagesSquare,
  BookOpenCheck,
} from 'lucide-react';
import HomeCard from "@/components/HomeCard";
import { useAuth } from "@/contexts/AuthContext";
import { ADMIN, ESTUDANTE } from "@/consts";
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
  const isAdmin = user.id_level === ADMIN;

  return (
    <AppLayout showBack={false}>
      <main className="p-6">
        <h1 className="text-3xl font-light mb-6">Página inicial</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {isStudent ? (
            <>
              <HomeCard label="Triagem" icon={ClipboardPlus} href="/triagem" />
              <HomeCard label="Anamnese" icon={Stethoscope} href="/anamnese" />
              <HomeCard label="Comentários Multiprofissionais" icon={MessagesSquare} href="/comentarios" />
              <HomeCard label="PEI" icon={BookOpenCheck} href="/pei" />
            </>
          ) : isAdmin ? (
            <>
              <HomeCard label="Pessoas" icon={Users} href="/estudantes" />
              <HomeCard label="Cadastrar novas pessoas" icon={ClipboardPlus} href="/admin/usuarios/cadastro" />
            </>
          ) : (
            <HomeCard label="Pessoas" icon={Users} href="/estudantes" />
          )}
        </div>
      </main>
    </AppLayout>
  );
}
