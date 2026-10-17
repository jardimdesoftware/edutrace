"use client";

import { listAeePlans } from "@/api/aeePlans";
import { useDoEstudante } from "./useDoEstudante";

// planos vem vazia quando o estudante ainda não tem PAEE, do período mais
// recente para o mais antigo; erro só vem preenchido quando a leitura falhou.
export function useAeePlans(email: string | null) {
  const { dados, ...carga } = useDoEstudante(email, listAeePlans, "os PAEE do estudante");

  return { ...carga, planos: dados ?? [] };
}
