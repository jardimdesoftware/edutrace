"use client";

import type { ReactNode, RefObject } from "react";
import AcoesDoAssistente, { type AcoesDoAssistenteProps } from "./AcoesDoAssistente";
import IndicadorDePassos from "./IndicadorDePassos";

interface AssistenteDePassosProps {
  titulo: string;
  estudante?: string;
  // Quando o documento foi criado e por quem; fica sob o título.
  resumo?: ReactNode;
  // Botões do documento que não são do formulário, como Excluir.
  acoesDoDocumento?: ReactNode;
  passos: readonly { rotulo: string }[];
  atual: number;
  comPendencia: readonly boolean[];
  visitados: readonly boolean[];
  onIrPara: (indice: number) => void;
  tituloDoPasso: string;
  tituloRef: RefObject<HTMLHeadingElement | null>;
  acoes: AcoesDoAssistenteProps;
  children: ReactNode;
}

// Cartão do formulário em passos. Em telas grandes ele ocupa a altura que sobra
// na tela e só o corpo do passo rola, se um passo não couber; nas pequenas a
// página rola e a barra de ações fica presa ao rodapé.
export default function AssistenteDePassos({
  titulo,
  estudante,
  resumo,
  acoesDoDocumento,
  passos,
  atual,
  comPendencia,
  visitados,
  onIrPara,
  tituloDoPasso,
  tituloRef,
  acoes,
  children,
}: AssistenteDePassosProps) {
  const total = passos.length;
  const variosPassos = total > 1;
  const progresso = ((atual + 1) / total) * 100;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 lg:h-full lg:min-h-[28rem]">
      <section
        aria-labelledby="assistente-titulo"
        className="flex min-h-0 flex-1 flex-col rounded-3xl border border-gray-200 bg-white shadow-sm"
      >
        <header className="space-y-3 border-b border-gray-100 px-5 pt-5 pb-3 lg:px-8">
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
            <h1 id="assistente-titulo" className="text-2xl font-bold text-emerald-900">
              {titulo}
            </h1>
            {estudante && <p className="text-sm text-gray-600">Estudante: {estudante}</p>}
          </div>
          {(resumo || acoesDoDocumento) && (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm text-gray-600">{resumo}</div>
              {acoesDoDocumento}
            </div>
          )}
          {variosPassos && (
            <>
              <IndicadorDePassos
                passos={passos}
                atual={atual}
                comPendencia={comPendencia}
                visitados={visitados}
                onIrPara={onIrPara}
              />
              <div aria-hidden="true" className="h-1 rounded-full bg-gray-100">
                <div
                  className="h-1 rounded-full bg-emerald-600 transition-[width] motion-reduce:transition-none"
                  style={{ width: `${progresso}%` }}
                />
              </div>
            </>
          )}
        </header>

        <div
          key={atual}
          role="region"
          aria-label={`Passo ${atual + 1} de ${total}: ${tituloDoPasso}`}
          tabIndex={0}
          className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 lg:px-8"
        >
          {variosPassos && (
            <p className="text-xs font-semibold tracking-wide text-gray-600 uppercase lg:hidden">
              Passo {atual + 1} de {total}
            </p>
          )}
          <h2
            ref={tituloRef}
            tabIndex={-1}
            className="text-xl font-semibold text-emerald-800 focus:outline-none"
          >
            {tituloDoPasso}
          </h2>
          {children}
        </div>
      </section>

      <AcoesDoAssistente {...acoes} />
    </div>
  );
}
