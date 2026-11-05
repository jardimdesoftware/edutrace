"use client";

import { Suspense } from "react";
import {
  deleteAnamnesis,
  getAnamneseByEmail,
  patchAnamnesis,
  postAnamneses,
} from "@/api/anamnesis";
import type { AnamnesisData } from "@/interfaces/AnamnesisData";
import {
  SECOES_ANAMNESE,
  formularioDaAnamnese,
  formularioVazio,
  montarCorpo,
  validarFormulario,
  type AnamnesePayload,
} from "@/utils/anamnese";
import DocumentoEmPassos from "./DocumentoEmPassos";
import Loading from "./Loading";

// As funções ficam fora do componente para a identidade delas não mudar a cada
// render: a página busca o documento de novo quando `carregar` muda.
const carregar = (email: string): Promise<AnamnesisData> => getAnamneseByEmail(email);
const criar = (email: string, _nome: string | null, corpo: AnamnesePayload) =>
  postAnamneses({ ...corpo, email });
const atualizar = (email: string, corpo: AnamnesePayload) => patchAnamnesis(corpo, email);

// A tela de leitura, criação e edição da anamnese. A rota de edição abre a mesma
// página já no formulário.
export default function AnamnesePagina({ iniciarEditando = false }: { iniciarEditando?: boolean }) {
  return (
    <Suspense fallback={<Loading />}>
      <DocumentoEmPassos
        titulo="Anamnese"
        tipoDeFormulario="ANAMNESIS"
        secoes={SECOES_ANAMNESE}
        prefixoDosIds="anamnese"
        chaveDeEdicao="/editar-anamnese"
        rotaDaLeitura="/anamnese"
        iniciarEditando={iniciarEditando}
        carregar={carregar}
        criar={criar}
        atualizar={atualizar}
        excluir={deleteAnamnesis}
        formularioVazio={formularioVazio}
        formularioDoDocumento={formularioDaAnamnese}
        montarCorpo={montarCorpo}
        validar={validarFormulario}
      />
    </Suspense>
  );
}
