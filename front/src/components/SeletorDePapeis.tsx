"use client";

import { ChevronDown } from "lucide-react";
import { fieldBoxClass, fieldLabelClass } from "@/components/auth/AuthFields";
import { alternarPapel, ROTULO_DO_PAPEL, rotulosDosPapeis } from "@/utils/papeis";

interface SeletorDePapeisProps {
  legenda: string;
  opcoes: readonly number[];
  valor: readonly number[];
  onChange: (proximos: number[]) => void;
  desabilitado?: boolean;
  legendaOculta?: boolean;
  descritoPor?: string;
  className?: string;
  retratil?: boolean;
}

// Caixas de seleção dos papéis. A regra de combinação (Admin e Estudante
// sozinhos, profissionais acumulando) está em alternarPapel; o back a confere de
// novo.
export default function SeletorDePapeis({
  legenda,
  opcoes,
  valor,
  onChange,
  desabilitado = false,
  legendaOculta = false,
  descritoPor,
  className = "",
  retratil = false,
}: SeletorDePapeisProps) {
  const caixas = opcoes.map((papel) => (
    <label key={papel} className="flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={valor.includes(papel)}
        onChange={(e) => onChange(alternarPapel(valor, papel, e.target.checked))}
        className="h-4 w-4 shrink-0 cursor-pointer accent-[#006ee8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#006ee8]"
      />
      {ROTULO_DO_PAPEL[papel]}
    </label>
  ));

  if (retratil) {
    return (
      <div className={className}>
        <span className={fieldLabelClass}>{legenda}</span>
        <details className="group relative">
          <summary
            className={`${fieldBoxClass} cursor-pointer list-none justify-between gap-2 [&::-webkit-details-marker]:hidden`}
          >
            <span className="min-w-0 truncate text-base text-[#071640]">
              {valor.length > 0 ? rotulosDosPapeis(valor).join(", ") : "Selecione os papéis"}
            </span>
            <ChevronDown
              className="h-5 w-5 shrink-0 text-[#315a91] transition-transform group-open:rotate-180"
              aria-hidden="true"
            />
          </summary>
          <fieldset
            className="absolute inset-x-0 top-full z-20 mt-1 flex flex-col gap-1.5 rounded-[10px] border-2 border-[#b9d0ee] bg-white p-3 shadow-[0_12px_28px_rgba(33,91,140,0.18)]"
            aria-describedby={descritoPor}
          >
            <legend className="sr-only">{legenda}</legend>
            {caixas}
          </fieldset>
        </details>
      </div>
    );
  }

  return (
    <fieldset className={className} disabled={desabilitado} aria-describedby={descritoPor}>
      <legend className={legendaOculta ? "sr-only" : "font-semibold"}>{legenda}</legend>
      <div className="mt-1 flex flex-col gap-1">{caixas}</div>
    </fieldset>
  );
}
