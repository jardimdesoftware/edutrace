"use client";

import {
  CAMINHO_DA_DISCIPLINA,
  CAMINHO_DO_SEMESTRE,
  LIMITES_PEI,
  SECOES_PEI,
  TITULO_EMENTA,
  TITULO_IDENTIFICACAO,
  validarPeiExistente,
  validarPeiNovo,
  type PeiEntryForm,
} from "@/utils/pei";
import { NAO_INFORMADO } from "@/utils/formularioPorTabela";
import FormularioPorTabela from "./FormularioPorTabela";
import PeiParesDaEmenta from "./PeiParesDaEmenta";
import { TextField } from "./form/InputField";

// "AAAA.S"
const TAMANHO_DO_SEMESTRE = 6;

interface PeiFormularioProps {
  inicial: PeiEntryForm;
  // O semestre e a disciplina só se escolhem na criação; o registro já criado
  // os mantém.
  novo: boolean;
  autor: string | null;
  salvando: boolean;
  onSalvar: (form: PeiEntryForm) => void;
  onCancelar: () => void;
}

export function DadoFixo({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div>
      <dt className="text-gray-600">{rotulo}</dt>
      <dd className="font-medium text-gray-900">{valor.trim() || NAO_INFORMADO}</dd>
    </div>
  );
}

export default function PeiFormulario({
  inicial,
  novo,
  autor,
  salvando,
  onSalvar,
  onCancelar,
}: PeiFormularioProps) {
  return (
    <FormularioPorTabela
      secoes={SECOES_PEI}
      prefixoDosIds="pei"
      inicial={inicial}
      validar={novo ? validarPeiNovo : validarPeiExistente}
      rotuloSalvar="Salvar registro"
      salvando={salvando}
      onSalvar={onSalvar}
      onCancelar={onCancelar}
      cabecalhoDaSecao={(secao, controle) => {
        const { valores, erros, alterar, idDoCampo } = controle;

        if (secao.titulo === TITULO_EMENTA) return <PeiParesDaEmenta controle={controle} />;
        if (secao.titulo !== TITULO_IDENTIFICACAO) return null;

        return (
          <>
            {novo && (
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField
                  id={idDoCampo(CAMINHO_DO_SEMESTRE)}
                  rotulo="Semestre"
                  valor={valores.semester}
                  tamanhoMaximo={TAMANHO_DO_SEMESTRE}
                  ajuda="Formato AAAA.S, com semestre 1 ou 2, por exemplo 2026.2. Não pode ser alterado depois."
                  erro={erros[CAMINHO_DO_SEMESTRE]}
                  onChange={(semestre) => alterar(CAMINHO_DO_SEMESTRE, semestre)}
                />
                <TextField
                  id={idDoCampo(CAMINHO_DA_DISCIPLINA)}
                  rotulo="Disciplina"
                  valor={valores.subject}
                  tamanhoMaximo={LIMITES_PEI.DISCIPLINA}
                  ajuda={`Até ${LIMITES_PEI.DISCIPLINA} caracteres. Não pode ser alterada depois.`}
                  erro={erros[CAMINHO_DA_DISCIPLINA]}
                  onChange={(disciplina) => alterar(CAMINHO_DA_DISCIPLINA, disciplina)}
                />
              </div>
            )}
            <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              {!novo && (
                <DadoFixo rotulo="Semestre (não pode ser alterado)" valor={valores.semester} />
              )}
              {!novo && (
                <DadoFixo rotulo="Disciplina (não pode ser alterada)" valor={valores.subject} />
              )}
              <DadoFixo rotulo="Professor(a) (autor)" valor={autor ?? ""} />
            </dl>
          </>
        );
      }}
    />
  );
}
