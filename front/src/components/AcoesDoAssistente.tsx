"use client";

import { ArrowLeft, ArrowRight, Check, LogOut, Lock, Pencil, X } from "lucide-react";
import {
  BOTAO_BLOQUEADO,
  BOTAO_CANCELAR,
  BOTAO_PRIMARIO,
  BOTAO_SECUNDARIO,
  BOTAO_VOLTAR,
} from "./form/botoes";

export type ModoDoFormulario = "criar" | "editar" | "ver";

export interface AcoesDoAssistenteProps {
  modo: ModoDoFormulario;
  temAnterior: boolean;
  temProximo: boolean;
  onVoltar: () => void;
  onProximo: () => void;
  onCancelar: () => void;
  onConcluir: () => void;
  // Só existe ao visualizar um registro que o usuário pode editar.
  onEditar?: () => void;
  concluirBloqueado: boolean;
  // Por que o Concluir está bloqueado; ligado ao botão por aria-describedby.
  textoDeApoio: string;
  idDoApoio: string;
  salvando: boolean;
}

const ICONE = 16;

// Os botões ficam fora do cartão do formulário: Cancelar à esquerda, a ação
// final (Concluir ou Editar) ao centro e a navegação à direita. Sem cor de
// fundo própria além do Concluir, para a ação final se destacar.
export default function AcoesDoAssistente({
  modo,
  temAnterior,
  temProximo,
  onVoltar,
  onProximo,
  onCancelar,
  onConcluir,
  onEditar,
  concluirBloqueado,
  textoDeApoio,
  idDoApoio,
  salvando,
}: AcoesDoAssistenteProps) {
  const ver = modo === "ver";

  return (
    <div className="sticky bottom-0 z-10 space-y-2 bg-white/90 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur lg:static lg:bg-transparent lg:py-0">
      {concluirBloqueado && textoDeApoio && (
        <p id={idDoApoio} className="text-center text-sm text-amber-800">
          {textoDeApoio}
        </p>
      )}
      <div className="grid grid-cols-2 items-center gap-3 sm:grid-cols-[1fr_auto_1fr]">
        <div className="sm:justify-self-start">
          <button type="button" className={BOTAO_CANCELAR} onClick={onCancelar} disabled={salvando}>
            {ver ? <LogOut size={ICONE} aria-hidden="true" /> : <X size={ICONE} aria-hidden="true" />}
            {ver ? "Sair" : "Cancelar"}
          </button>
        </div>

        <div className="justify-self-end sm:justify-self-center">
          {ver
            ? onEditar && (
                <button type="button" className={BOTAO_PRIMARIO} onClick={onEditar}>
                  <Pencil size={ICONE} aria-hidden="true" />
                  Editar
                </button>
              )
            : (
                <button
                  type="button"
                  className={concluirBloqueado ? BOTAO_BLOQUEADO : BOTAO_PRIMARIO}
                  onClick={onConcluir}
                  disabled={salvando}
                  aria-disabled={concluirBloqueado || undefined}
                  aria-describedby={concluirBloqueado && textoDeApoio ? idDoApoio : undefined}
                >
                  {concluirBloqueado ? (
                    <Lock size={ICONE} aria-hidden="true" />
                  ) : (
                    <Check size={ICONE} aria-hidden="true" />
                  )}
                  {salvando ? "Concluindo..." : "Concluir"}
                </button>
              )}
        </div>

        <div className="col-span-2 flex justify-end gap-2 sm:col-span-1 sm:justify-self-end">
          {temAnterior && (
            <button type="button" className={BOTAO_VOLTAR} onClick={onVoltar} disabled={salvando}>
              <ArrowLeft size={ICONE} aria-hidden="true" />
              Voltar
            </button>
          )}
          {temProximo && (
            <button type="button" className={BOTAO_SECUNDARIO} onClick={onProximo} disabled={salvando}>
              Próximo
              <ArrowRight size={ICONE} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
