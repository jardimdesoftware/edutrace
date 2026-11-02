"use client";

import { Check, CircleAlert } from "lucide-react";
import { useEffect, useRef } from "react";

interface IndicadorDePassosProps {
  passos: readonly { rotulo: string }[];
  atual: number;
  // Passo com erro que o usuário já deve ver (ele saiu do passo ou tentou concluir).
  comPendencia: readonly boolean[];
  visitados: readonly boolean[];
  onIrPara: (indice: number) => void;
}

// Enquanto os rótulos somarem até este número de letras, todos aparecem; com
// mais, a barra de passos não cabe numa linha e só o passo atual mostra o rótulo.
const LETRAS_DOS_ROTULOS = 90;

const BASE = "flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:ring-offset-1";
const ESTILO_ATUAL = "border-emerald-700 bg-emerald-700 text-white";
const ESTILO_PENDENTE = "border-amber-500 bg-amber-50 text-amber-900 hover:bg-amber-100";
const ESTILO_VISITADO = "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100";
const ESTILO_NOVO = "border-gray-300 bg-gray-50 text-gray-700 hover:bg-gray-100";

function estiloDoPasso(atual: boolean, pendente: boolean, visitado: boolean): string {
  if (atual) return ESTILO_ATUAL;
  if (pendente) return ESTILO_PENDENTE;
  return visitado ? ESTILO_VISITADO : ESTILO_NOVO;
}

// Passos como botões de uma lista, e não como abas: o usuário vai a qualquer
// passo quando quiser, e não há painéis ligados por teclas de seta. Só o passo
// atual mostra o rótulo quando são muitos passos, e o nome dos outros aparece
// ao passar o mouse; para o leitor de tela todos o têm.
export default function IndicadorDePassos({
  passos,
  atual,
  comPendencia,
  visitados,
  onIrPara,
}: IndicadorDePassosProps) {
  const botaoAtual = useRef<HTMLButtonElement>(null);
  const todosOsRotulos =
    passos.reduce((soma, passo) => soma + passo.rotulo.length, 0) <= LETRAS_DOS_ROTULOS;

  useEffect(() => {
    botaoAtual.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [atual]);

  return (
    <nav aria-label="Passos do formulário">
      <ol className="flex gap-2 overflow-x-auto p-1">
        {passos.map((passo, indice) => {
          const ehAtual = indice === atual;
          const pendente = comPendencia[indice] && !ehAtual;
          const visitado = visitados[indice] && !ehAtual;

          return (
            <li key={`${indice}-${passo.rotulo}`} className="shrink-0">
              <button
                type="button"
                ref={ehAtual ? botaoAtual : undefined}
                aria-current={ehAtual ? "step" : undefined}
                title={passo.rotulo}
                onClick={() => onIrPara(indice)}
                className={`${BASE} ${estiloDoPasso(ehAtual, pendente, visitado)}`}
              >
                <span aria-hidden="true" className="flex h-5 w-5 items-center justify-center text-xs">
                  {pendente ? <CircleAlert size={16} /> : visitado ? <Check size={16} /> : indice + 1}
                </span>
                <span className={ehAtual || todosOsRotulos ? "" : "sr-only"}>{passo.rotulo}</span>
                {pendente && <span className="sr-only">(com pendência)</span>}
                {visitado && !pendente && <span className="sr-only">(visitado)</span>}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
