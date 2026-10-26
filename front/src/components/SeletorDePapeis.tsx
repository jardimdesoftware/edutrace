"use client";

import { alternarPapel, ROTULO_DO_PAPEL } from "@/utils/papeis";

interface SeletorDePapeisProps {
  legenda: string;
  opcoes: readonly number[];
  valor: readonly number[];
  onChange: (proximos: number[]) => void;
  desabilitado?: boolean;
  legendaOculta?: boolean;
  descritoPor?: string;
  className?: string;
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
}: SeletorDePapeisProps) {
  return (
    <fieldset className={className} disabled={desabilitado} aria-describedby={descritoPor}>
      <legend className={legendaOculta ? "sr-only" : "font-semibold"}>{legenda}</legend>
      <div className="mt-1 flex flex-col gap-1">
        {opcoes.map((papel) => (
          <label key={papel} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={valor.includes(papel)}
              onChange={(e) => onChange(alternarPapel(valor, papel, e.target.checked))}
              className="h-4 w-4 shrink-0 cursor-pointer accent-[#006ee8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#006ee8]"
            />
            {ROTULO_DO_PAPEL[papel]}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
