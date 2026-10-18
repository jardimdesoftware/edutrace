"use client";

import { useEffect, useRef } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  CAMINHO_DOS_PARES,
  LIMITES_PEI,
  caminhoDoParDe,
  type PeiEntryForm,
} from "@/utils/pei";
import type { ControleDoFormulario } from "./FormularioPorTabela";
import { BOTAO_PERIGO, BOTAO_SECUNDARIO } from "./form/botoes";
import { FormFieldset } from "./form/FormSection";
import TextAreaField from "./form/TextAreaField";

const LINHAS_DO_PAR = 2;

// Lista de pares "conteúdo previsto na ementa" e "adequação" do registro do PEI,
// que o professor aumenta e diminui. Cada par é um grupo com a legenda "Par N",
// para o leitor de tela distinguir os campos que repetem o rótulo.
export default function PeiParesDaEmenta({
  controle,
}: {
  controle: ControleDoFormulario<PeiEntryForm>;
}) {
  const { valores, erros, alterar, definir, idDoCampo } = controle;
  const pares = valores.syllabus_adaptations;
  const idDaLista = idDoCampo(CAMINHO_DOS_PARES);
  const erroDaLista = erros[CAMINHO_DOS_PARES];
  const erroDaListaId = `${idDaLista}-erro`;
  const noLimite = pares.length >= LIMITES_PEI.MAXIMO_DE_PARES;

  // Quem adiciona um par vai para o primeiro campo dele; quem remove perde o
  // botão em que clicou e vai para a lista.
  const foco = useRef<string | null>(null);
  useEffect(() => {
    if (foco.current) document.getElementById(foco.current)?.focus();
    foco.current = null;
  }, [pares.length]);

  const adicionar = () => {
    foco.current = idDoCampo(caminhoDoParDe(pares.length, "syllabus_content"));
    definir(CAMINHO_DOS_PARES, [...pares, { syllabus_content: "", adaptation: "" }]);
  };

  const remover = (indice: number) => {
    foco.current = idDaLista;
    definir(
      CAMINHO_DOS_PARES,
      pares.filter((_, posicao) => posicao !== indice),
    );
  };

  return (
    <div
      id={idDaLista}
      tabIndex={-1}
      aria-describedby={erroDaLista ? erroDaListaId : undefined}
      className="space-y-4 focus:outline-none"
    >
      <p className="text-sm text-gray-600">
        Cada par liga um conteúdo previsto na ementa à adequação feita para o estudante. Até{" "}
        {LIMITES_PEI.MAXIMO_DE_PARES} pares.
      </p>

      {pares.length === 0 && <p className="text-sm text-gray-700">Nenhum par adicionado.</p>}

      {pares.map((par, indice) => {
        const caminhoDoConteudo = caminhoDoParDe(indice, "syllabus_content");
        const caminhoDaAdequacao = caminhoDoParDe(indice, "adaptation");

        return (
          <FormFieldset key={indice} legenda={`Par ${indice + 1}`}>
            <TextAreaField
              id={idDoCampo(caminhoDoConteudo)}
              rotulo="Conteúdo previsto na ementa"
              valor={par.syllabus_content}
              tamanhoMaximo={LIMITES_PEI.CONTEUDO_PREVISTO}
              linhas={LINHAS_DO_PAR}
              erro={erros[caminhoDoConteudo]}
              onChange={(valor) => alterar(caminhoDoConteudo, valor)}
            />
            <TextAreaField
              id={idDoCampo(caminhoDaAdequacao)}
              rotulo="Adequação"
              valor={par.adaptation}
              tamanhoMaximo={LIMITES_PEI.ADEQUACAO}
              linhas={LINHAS_DO_PAR}
              erro={erros[caminhoDaAdequacao]}
              onChange={(valor) => alterar(caminhoDaAdequacao, valor)}
            />
            <button type="button" className={BOTAO_PERIGO} onClick={() => remover(indice)}>
              <Trash2 size={16} aria-hidden="true" />
              Remover par {indice + 1}
            </button>
          </FormFieldset>
        );
      })}

      {erroDaLista && (
        <p id={erroDaListaId} className="text-sm text-red-700">
          {erroDaLista}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className={BOTAO_SECUNDARIO} onClick={adicionar} disabled={noLimite}>
          <Plus size={16} aria-hidden="true" />
          Adicionar par
        </button>
        {noLimite && (
          <p className="text-sm text-gray-600">
            Limite de {LIMITES_PEI.MAXIMO_DE_PARES} pares atingido.
          </p>
        )}
      </div>
    </div>
  );
}
