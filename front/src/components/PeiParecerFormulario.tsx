"use client";

import { SECOES_PARECER, validarParecer, type PeiOpinionForm } from "@/utils/pei";
import FormularioPorTabela from "./FormularioPorTabela";
import { DadoFixo } from "./PeiFormulario";

interface PeiParecerFormularioProps {
  inicial: PeiOpinionForm;
  semestre: string;
  disciplina: string;
  estudante?: string;
  autor: string | null;
  salvando: boolean;
  onSalvar: (form: PeiOpinionForm) => void;
  onCancelar: () => void;
}

// Formulário do parecer semestral de um registro do PEI: as quatro áreas de
// texto da tabela SECOES_PARECER, sob a identificação do registro a que o
// parecer pertence. Grava só os quatro campos, em um PATCH à parte do conteúdo.
export default function PeiParecerFormulario({
  inicial,
  semestre,
  disciplina,
  estudante,
  autor,
  salvando,
  onSalvar,
  onCancelar,
}: PeiParecerFormularioProps) {
  return (
    <FormularioPorTabela
      titulo="Parecer semestral do PEI"
      estudante={estudante}
      modo="editar"
      secoes={SECOES_PARECER}
      prefixoDosIds="pei-parecer"
      inicial={inicial}
      validar={validarParecer}
      salvando={salvando}
      onSalvar={onSalvar}
      onCancelar={onCancelar}
      cabecalhoDaSecao={() => (
        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          <DadoFixo rotulo="Semestre" valor={semestre} />
          <DadoFixo rotulo="Disciplina" valor={disciplina} />
          <DadoFixo rotulo="Professor(a) (autor)" valor={autor ?? ""} />
        </dl>
      )}
    />
  );
}
