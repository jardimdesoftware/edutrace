"use client";

import { getCaseStudy } from "@/api/caseStudies";
import { useDoEstudante } from "./useDoEstudante";

// estudo é null quando o estudante ainda não tem estudo de caso; erro só vem
// preenchido quando a leitura falhou.
export function useEstudoDeCaso(email: string | null) {
  const { dados, ...carga } = useDoEstudante(email, getCaseStudy, "o estudo de caso");

  return { ...carga, estudo: dados };
}
