"use client";

import { listPeiEntries } from "@/api/peiEntries";
import { useDoEstudante } from "./useDoEstudante";

// registros vem vazia quando o estudante ainda não tem PEI; erro só vem
// preenchido quando a leitura falhou.
export function usePeiEntries(email: string | null) {
  const { dados, ...carga } = useDoEstudante(email, listPeiEntries, "os registros do PEI do estudante");

  return { ...carga, registros: dados ?? [] };
}
