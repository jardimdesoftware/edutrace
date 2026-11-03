"use client";

import { useCallback, useEffect, useState } from "react";
import { getCaseStudy } from "@/api/caseStudies";
import type { CaseStudy } from "@/interfaces/CaseStudy";

const ERRO_AO_CARREGAR = "Não foi possível carregar o estudo de caso.";

type Carga = { email: string; estudo: CaseStudy | null; erro: string | null };

async function buscar(email: string): Promise<Carga> {
  try {
    return { email, estudo: await getCaseStudy(email), erro: null };
  } catch (erro) {
    console.error("Erro ao buscar o estudo de caso:", erro);
    return {
      email,
      estudo: null,
      erro: erro instanceof Error ? erro.message : ERRO_AO_CARREGAR,
    };
  }
}

// estudo é null quando o estudante ainda não tem estudo de caso; erro só vem
// preenchido quando a leitura falhou. A carga guarda o e-mail a que pertence,
// então trocar de estudante volta a "carregando" sem apagar estado no efeito.
export function useEstudoDeCaso(email: string | null) {
  const [carga, setCarga] = useState<Carga | null>(null);

  useEffect(() => {
    if (!email) return;

    let ativo = true;
    buscar(email).then((resultado) => {
      if (ativo) setCarga(resultado);
    });

    return () => {
      ativo = false;
    };
  }, [email]);

  const recarregar = useCallback(async () => {
    if (email) setCarga(await buscar(email));
  }, [email]);

  const tentarDeNovo = useCallback(() => {
    setCarga(null);
    return recarregar();
  }, [recarregar]);

  const atual = carga?.email === email ? carga : null;

  return {
    carregando: !!email && !atual,
    estudo: atual?.estudo ?? null,
    erro: atual?.erro ?? null,
    recarregar,
    tentarDeNovo,
  };
}
