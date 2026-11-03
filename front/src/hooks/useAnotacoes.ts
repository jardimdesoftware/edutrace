"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { listComments } from "@/api/comments";
import { montarConsulta, proximaBusca, type CommentFilters } from "@/utils/commentFilters";
import {
  cargaComErro,
  cargaComErroDeMais,
  cargaComMais,
  cargaConcluida,
  criarSequencia,
  estadoDaLista,
  type Carga,
} from "@/utils/commentPages";

// Espera depois da última tecla antes de mandar a busca por texto ao servidor.
const ESPERA_DA_BUSCA_MS = 300;

const ERRO_DA_LISTA = "Não foi possível carregar as anotações.";

function mensagemDoErro(erro: unknown): string {
  return erro instanceof Error ? erro.message : ERRO_DA_LISTA;
}

// A busca que vale para o servidor (ver proximaBusca): a vazia vale na hora, e
// as demais, depois da espera. Apagar o campo zera também o valor guardado, para
// que a próxima digitação não mande a busca de antes enquanto espera.
function useBuscaAtrasada(digitada: string): string {
  const [valida, setValida] = useState(() => proximaBusca(digitada, "", true));

  const atual = proximaBusca(digitada, valida, false);
  if (atual !== valida) setValida(atual);

  useEffect(() => {
    const espera = setTimeout(
      () => setValida((anterior) => proximaBusca(digitada, anterior, true)),
      ESPERA_DA_BUSCA_MS,
    );
    return () => clearTimeout(espera);
  }, [digitada]);

  return atual;
}

// Lista paginada das anotações do estudante, com os filtros aplicados no
// servidor. Só a busca por texto espera; os demais filtros buscam na hora. A
// resposta de uma consulta que deixou de ser a última é descartada. O estado
// (de quem é a página, o que vale para a consulta de agora) está em
// commentPages.ts.
export function useAnotacoes(idEstudante: number | null, filtros: CommentFilters) {
  const busca = useBuscaAtrasada(filtros.busca);
  const { idAutor, area, tipo, de, ate, soEditadas } = filtros;
  const consulta = useMemo(
    () => montarConsulta({ busca, idAutor, area, tipo, de, ate, soEditadas }),
    [busca, idAutor, area, tipo, de, ate, soEditadas],
  );

  const [tentativa, setTentativa] = useState(0);
  const [sequencia] = useState(criarSequencia);
  const [carga, setCarga] = useState<Carga | null>(null);
  const [maisDaChave, setMaisDaChave] = useState<string | null>(null);

  const chave = JSON.stringify([idEstudante, tentativa, consulta]);

  useEffect(() => {
    if (idEstudante === null) return;

    const aindaVale = sequencia();

    listComments(idEstudante, consulta).then(
      (pagina) => {
        if (aindaVale()) setCarga(cargaConcluida(chave, idEstudante, pagina));
      },
      (erro: unknown) => {
        console.error("Erro ao buscar anotações:", erro);
        if (!aindaVale()) return;

        setCarga((anterior) => cargaComErro(anterior, chave, idEstudante, mensagemDoErro(erro)));
      },
    );
  }, [idEstudante, consulta, chave, sequencia]);

  const { pagina, carregando, erro, erroMais, proximo, temMais } = estadoDaLista(
    carga,
    idEstudante,
    chave,
  );

  const carregarMais = useCallback(async () => {
    if (idEstudante === null || proximo === null) return;

    const aindaVale = sequencia();
    setMaisDaChave(chave);

    try {
      const nova = await listComments(idEstudante, { ...consulta, cursor: proximo });
      if (!aindaVale()) return;

      setCarga((atual) => cargaComMais(atual, chave, nova));
    } catch (falha) {
      console.error("Erro ao buscar mais anotações:", falha);
      if (!aindaVale()) return;

      setCarga((atual) => cargaComErroDeMais(atual, chave, mensagemDoErro(falha)));
    } finally {
      setMaisDaChave((atual) => (atual === chave ? null : atual));
    }
  }, [idEstudante, consulta, chave, proximo, sequencia]);

  // Busca de novo a primeira página com os filtros de agora (depois de criar ou
  // editar uma anotação, ou para tentar outra vez depois de um erro).
  const recarregar = useCallback(() => setTentativa((atual) => atual + 1), []);

  return {
    pagina,
    carregando,
    carregandoMais: maisDaChave === chave,
    erro,
    erroMais,
    temMais,
    carregarMais,
    recarregar,
  };
}
