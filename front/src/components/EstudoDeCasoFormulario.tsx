"use client";

import type { ReactNode } from "react";
import type { CaseStudy, CaseStudyPayload } from "@/interfaces/CaseStudy";
import {
  SECOES,
  TITULO_IDENTIFICACAO,
  montarCorpo,
  secoesParaLeitura,
  validarFormulario,
  type EstudoDeCasoForm,
} from "@/utils/estudoDeCaso";
import { formatarData } from "@/utils/formatDate";
import { resumoDoDocumento } from "@/utils/resumoDoDocumento";
import type { ModoDoFormulario } from "./AcoesDoAssistente";
import FormularioPorTabela, { DadosDoCadastro } from "./FormularioPorTabela";

interface FormularioProps {
  inicial: EstudoDeCasoForm;
  // O estudo gravado: só no modo "ver", que o lê passo a passo.
  estudo?: CaseStudy;
  modo: ModoDoFormulario;
  estudante?: string;
  // undefined é o curso que a tela não conhece; null é o cadastro sem curso.
  curso?: string | null;
  autor: string | null;
  salvando: boolean;
  onSalvar: (corpo: CaseStudyPayload) => void;
  onCancelar: () => void;
  onEditar?: () => void;
  acoesDoDocumento?: ReactNode;
  // Autoria do documento, à direita do título.
  ladoDoTitulo?: ReactNode;
  // Aviso do documento, sob o título (por exemplo, uma versão antiga aberta).
  aviso?: ReactNode;
}

export default function EstudoDeCasoFormulario({
  inicial,
  estudo,
  modo,
  estudante,
  curso,
  autor,
  salvando,
  onSalvar,
  onCancelar,
  onEditar,
  acoesDoDocumento,
  ladoDoTitulo,
  aviso,
}: FormularioProps) {
  return (
    <FormularioPorTabela
      titulo="Estudo de caso"
      estudante={estudante}
      acoesDoDocumento={acoesDoDocumento}
      ladoDoTitulo={ladoDoTitulo}
      aviso={aviso}
      resumo={
        estudo &&
        resumoDoDocumento(estudo.created_at, estudo.updated_at, estudo.author?.full_name ?? null, formatarData)
      }
      secoes={SECOES}
      prefixoDosIds="estudo-de-caso"
      inicial={inicial}
      validar={validarFormulario}
      modo={modo}
      salvando={salvando}
      onSalvar={(form) => onSalvar(montarCorpo(form))}
      onCancelar={onCancelar}
      onEditar={onEditar}
      leituraDoPasso={estudo ? (secoes) => secoesParaLeitura(estudo, curso, secoes) : undefined}
      cabecalhoDaSecao={(secao) =>
        secao.titulo === TITULO_IDENTIFICACAO && <DadosDoCadastro curso={curso} autor={autor} />
      }
    />
  );
}
