"use client";

import { useEffect, useRef } from "react";
import PainelAtendimento from "./PainelAtendimento";

interface EstatisticasAtendimentoModalProps {
  onClose: () => void;
}

export default function EstatisticasAtendimentoModal({
  onClose,
}: EstatisticasAtendimentoModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="painel-atendimento-titulo"
      onClose={onClose}
      onClick={(evento) => {
        if (evento.target === evento.currentTarget) onClose();
      }}
      className="m-auto w-[min(60rem,calc(100vw-2rem))] max-h-[calc(100vh-2rem)] overflow-y-auto rounded-2xl border border-[#dce8f4] bg-white p-0 text-left shadow-[0_14px_40px_rgba(28,67,112,0.18)] backdrop:bg-slate-900/40"
    >
      <div className="p-5 sm:p-7">
        <PainelAtendimento />
        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-[#006ee8] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#005fc9] focus:outline-none focus:ring-4 focus:ring-[#b8dcff]"
          >
            Fechar
          </button>
        </div>
      </div>
    </dialog>
  );
}
