"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { ESTILO_DO_VOLTAR } from "./estiloDoVoltar";

export default function BackButton() {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => router.back()}
      className={`absolute left-10 top-1.5 z-20 ${ESTILO_DO_VOLTAR}`}
    >
      <ArrowLeft className="w-4 h-4" />
      Voltar
    </button>
  );
}
