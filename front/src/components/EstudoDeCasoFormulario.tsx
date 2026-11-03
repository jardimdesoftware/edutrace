"use client";

import type { CaseStudyPayload } from "@/interfaces/CaseStudy";
import {
  SECOES,
  TITULO_IDENTIFICACAO,
  montarCorpo,
  validarFormulario,
  type EstudoDeCasoForm,
} from "@/utils/estudoDeCaso";
import FormularioPorTabela, { DadosDoCadastro } from "./FormularioPorTabela";

interface FormularioProps {
  inicial: EstudoDeCasoForm;
  // undefined é o curso que a tela não conhece; null é o cadastro sem curso.
  curso?: string | null;
  autor: string | null;
  salvando: boolean;
  onSalvar: (corpo: CaseStudyPayload) => void;
  onCancelar: () => void;
}

export default function EstudoDeCasoFormulario({
  inicial,
  curso,
  autor,
  salvando,
  onSalvar,
  onCancelar,
}: FormularioProps) {
  return (
    <FormularioPorTabela
      secoes={SECOES}
      prefixoDosIds="estudo-de-caso"
      inicial={inicial}
      validar={validarFormulario}
      rotuloSalvar="Salvar estudo de caso"
      salvando={salvando}
      onSalvar={(form) => onSalvar(montarCorpo(form))}
      onCancelar={onCancelar}
      cabecalhoDaSecao={(secao) =>
        secao.titulo === TITULO_IDENTIFICACAO && <DadosDoCadastro curso={curso} autor={autor} />
      }
    />
  );
}
