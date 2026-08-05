"use client";

import AppLayout from "@/components/AppLayout";
import ExportReport from "@/components/ExportReport";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

// Esta função é o componente principal da página e DEVE ser a exportação padrão.
export default function RelatorioPageWrapper() { // <--- ADICIONE O 'export default' AQUI
  return (
    <Suspense fallback={<div>Carregando...</div>}>
      <RelatorioPage />
    </Suspense>
  );
}

// Esta é uma função interna, então não precisa de exportação.
function RelatorioPage() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email");
  const nome = searchParams.get("nome");

  return (
    <AppLayout
    >
      <ExportReport email={email} nome={nome} />
    </AppLayout>
  );
}
