"use client";

import type { AeePlanPayload } from "@/interfaces/AeePlan";
import {
  CAMINHO_DO_PERIODO,
  SECOES_PAEE,
  TITULO_IDENTIFICACAO,
  montarCorpoDoPlano,
  validarPlanoExistente,
  validarPlanoNovo,
  type AeePlanForm,
} from "@/utils/paee";
import FormularioPorTabela, { DadosDoCadastro } from "./FormularioPorTabela";
import { TextField } from "./form/InputField";

// "AAAA.S"
const TAMANHO_DO_PERIODO = 6;

interface PaeeFormularioProps {
  inicial: AeePlanForm;
  // O período letivo só se escolhe na criação; o PAEE já criado o mantém.
  novo: boolean;
  // undefined é o curso que a tela não conhece; null é o cadastro sem curso.
  curso?: string | null;
  autor: string | null;
  salvando: boolean;
  onSalvar: (periodo: string, corpo: AeePlanPayload) => void;
  onCancelar: () => void;
}

export default function PaeeFormulario({
  inicial,
  novo,
  curso,
  autor,
  salvando,
  onSalvar,
  onCancelar,
}: PaeeFormularioProps) {
  return (
    <FormularioPorTabela
      secoes={SECOES_PAEE}
      prefixoDosIds="paee"
      inicial={inicial}
      validar={novo ? validarPlanoNovo : validarPlanoExistente}
      rotuloSalvar="Salvar PAEE"
      salvando={salvando}
      onSalvar={(form) => onSalvar(form.semester.trim(), montarCorpoDoPlano(form))}
      onCancelar={onCancelar}
      cabecalhoDaSecao={(secao, { valores, erros, alterar, idDoCampo }) =>
        secao.titulo === TITULO_IDENTIFICACAO && (
          <>
            {novo && (
              <TextField
                id={idDoCampo(CAMINHO_DO_PERIODO)}
                rotulo="Período letivo"
                valor={valores.semester}
                tamanhoMaximo={TAMANHO_DO_PERIODO}
                ajuda="Formato AAAA.S, com semestre 1 ou 2, por exemplo 2026.1. Não pode ser alterado depois."
                erro={erros[CAMINHO_DO_PERIODO]}
                onChange={(periodo) => alterar(CAMINHO_DO_PERIODO, periodo)}
              />
            )}
            <DadosDoCadastro
              curso={curso}
              autor={autor}
              periodo={novo ? undefined : valores.semester}
            />
          </>
        )
      }
    />
  );
}
