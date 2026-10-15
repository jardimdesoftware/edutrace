"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Swal from "sweetalert2";
import { useAuth } from "@/contexts/AuthContext";
import { ESTUDANTE } from "@/consts";
import type { StudentData } from "@/interfaces/StudentData";
import { resolverEstudanteDaUrl } from "@/utils/estudanteDaUrl";

type Resultado = { id: string | null; registro: StudentData | null };

// O estudante acessa os próprios dados pela sessão. O profissional recebe o id
// do estudante na URL e resolve e-mail e nome pela API. Se o id não resolve um
// usuário da lista da sessão, volta para a home em vez de renderizar a tela sem
// estudante: o carregando continua verdadeiro até a navegação.
export function useEstudanteDaUrl() {
  const id = useSearchParams().get("id");
  const router = useRouter();
  const { user, loading } = useAuth();
  const isStudent = user?.id_level === ESTUDANTE;
  const precisaBuscar = !!user && !isStudent;
  const nivel = user?.id_level;

  const [resultado, setResultado] = useState<Resultado | null>(null);

  useEffect(() => {
    if (!precisaBuscar) return;

    let ativo = true;
    resolverEstudanteDaUrl(id, nivel).then((resolvido) => {
      if (!ativo) return;
      if ("registro" in resolvido) {
        setResultado({ id, registro: resolvido.registro });
        return;
      }
      // A home fica em outro root layout que parte das telas do estudante, e o
      // Next recarrega a página nessa navegação: o alerta sairia junto. Por isso
      // a navegação só acontece depois que o alerta é fechado.
      void Swal.fire(resolvido.alerta).then(() => {
        if (ativo) router.replace("/home");
      });
    });

    return () => {
      ativo = false;
    };
  }, [id, nivel, precisaBuscar, router]);

  if (isStudent && user) {
    return { id, email: user.email, nome: user.name, registro: null, carregando: false };
  }

  const registro = resultado?.id === id ? resultado.registro : null;
  return {
    id,
    email: registro?.email ?? null,
    nome: registro?.full_name ?? null,
    registro,
    carregando: loading || (precisaBuscar && resultado?.id !== id),
  };
}
