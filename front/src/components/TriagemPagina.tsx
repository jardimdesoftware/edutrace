"use client";

import { Suspense } from "react";
import {
  deleteScreening,
  getScreeningByEmail,
  patchScreening,
  postScreening,
} from "@/api/screenings";
import type { ScreeningData } from "@/interfaces/ScreeningData";
import {
  SECOES_TRIAGEM,
  formularioDaTriagem,
  formularioVazio,
  montarCorpo,
  validarFormulario,
  type TriagemPayload,
} from "@/utils/triagem";
import DocumentoEmPassos from "./DocumentoEmPassos";
import Loading from "./Loading";

// As funções ficam fora do componente para a identidade delas não mudar a cada
// render: a página busca o documento de novo quando `carregar` muda.
const carregar = (email: string): Promise<ScreeningData> => getScreeningByEmail(email);
// A API exige o nome do estudante e o atendimento especializado na criação; o
// nome vem do estudante da URL, e nenhuma tela pede o atendimento.
const criar = (email: string, nome: string | null, corpo: TriagemPayload) =>
  postScreening({
    ...corpo,
    email,
    full_name: nome || "Nome não encontrado",
    special_service: false,
  });
const atualizar = (email: string, corpo: TriagemPayload) => patchScreening(corpo, email);

// A tela de leitura, criação e edição da triagem. A rota de edição abre a mesma
// página já no formulário.
export default function TriagemPagina({ iniciarEditando = false }: { iniciarEditando?: boolean }) {
  return (
    <Suspense fallback={<Loading />}>
      <DocumentoEmPassos
        titulo="Triagem"
        secoes={SECOES_TRIAGEM}
        prefixoDosIds="triagem"
        chaveDeEdicao="/editar-triagem"
        rotaDaLeitura="/triagem"
        iniciarEditando={iniciarEditando}
        carregar={carregar}
        criar={criar}
        atualizar={atualizar}
        excluir={deleteScreening}
        formularioVazio={formularioVazio}
        formularioDoDocumento={formularioDaTriagem}
        montarCorpo={montarCorpo}
        validar={validarFormulario}
      />
    </Suspense>
  );
}
