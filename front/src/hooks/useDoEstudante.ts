"use client";

import { useCallback, useEffect, useState } from "react";

type Carga<T> = { email: string; dados: T | null; erro: string | null };

async function buscar<T>(
  email: string,
  carregar: (email: string) => Promise<T>,
  descricao: string,
): Promise<Carga<T>> {
  try {
    return { email, dados: await carregar(email), erro: null };
  } catch (erro) {
    console.error('Erro ao buscar %s:', descricao, erro);
    return {
      email,
      dados: null,
      erro: erro instanceof Error ? erro.message : `Não foi possível carregar ${descricao}.`,
    };
  }
}

// Carrega um documento do estudante pelo e-mail. descricao completa as
// mensagens ("o estudo de caso"); erro só vem preenchido quando a leitura
// falhou. A carga guarda o e-mail a que pertence, então trocar de estudante
// volta a "carregando" sem apagar estado no efeito. carregar precisa ser uma
// função estável, como as de src/api.
export function useDoEstudante<T>(
  email: string | null,
  carregar: (email: string) => Promise<T>,
  descricao: string,
) {
  const [carga, setCarga] = useState<Carga<T> | null>(null);

  useEffect(() => {
    if (!email) return;

    let ativo = true;
    buscar(email, carregar, descricao).then((resultado) => {
      if (ativo) setCarga(resultado);
    });

    return () => {
      ativo = false;
    };
  }, [email, carregar, descricao]);

  const recarregar = useCallback(async () => {
    if (email) setCarga(await buscar(email, carregar, descricao));
  }, [email, carregar, descricao]);

  const tentarDeNovo = useCallback(() => {
    setCarga(null);
    return recarregar();
  }, [recarregar]);

  const atual = carga?.email === email ? carga : null;

  return {
    carregando: !!email && !atual,
    dados: atual?.dados ?? null,
    erro: atual?.erro ?? null,
    recarregar,
    tentarDeNovo,
  };
}
