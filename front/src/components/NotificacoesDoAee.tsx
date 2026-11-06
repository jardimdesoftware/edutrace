"use client";

import { useEffect, useRef, useState } from "react";
import { BellRing } from "lucide-react";
import { listarAvisosDoEncaminhamento, marcarAvisosComoVistos } from "@/api/aeeReferrals";
import {
  textoDoAviso,
  tituloDosAvisos,
  type AvisoDoEncaminhamento,
} from "@/utils/encaminhamentoAee";

// O pop-up do Professor do AEE, no meio da tela: mostra os encaminhamentos que
// ele ainda não viu. Fechá-lo, de qualquer jeito, marca os avisos como vistos, e
// eles não voltam.
export default function NotificacoesDoAee() {
  const [avisos, setAvisos] = useState<AvisoDoEncaminhamento[]>([]);

  useEffect(() => {
    let ativo = true;
    listarAvisosDoEncaminhamento()
      .then((lista) => {
        if (ativo) setAvisos(lista);
      })
      .catch((error) => {
        // O aviso é complementar: sem ele a página segue normal.
        console.error("Não foi possível carregar os avisos de encaminhamento.", error);
      });

    return () => {
      ativo = false;
    };
  }, []);

  if (avisos.length === 0) return null;

  return <PopUpDosAvisos avisos={avisos} onFechar={() => setAvisos([])} />;
}

interface PopUpDosAvisosProps {
  avisos: AvisoDoEncaminhamento[];
  onFechar: () => void;
}

function PopUpDosAvisos({ avisos, onFechar }: PopUpDosAvisosProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const jaMarcou = useRef(false);

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  const fechar = () => {
    if (!jaMarcou.current) {
      jaMarcou.current = true;
      marcarAvisosComoVistos(avisos.map((aviso) => aviso.id)).catch((error) => {
        console.error("Não foi possível marcar os avisos como vistos.", error);
      });
    }
    onFechar();
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="avisos-titulo"
      onClose={fechar}
      className="m-auto w-[min(32rem,calc(100vw-2rem))] max-h-[calc(100vh-2rem)] overflow-y-auto rounded-2xl border border-[#dce8f4] bg-white p-0 text-left shadow-[0_14px_40px_rgba(28,67,112,0.25)] backdrop:bg-slate-900/50"
    >
      <div className="p-5 sm:p-7">
        <h2 id="avisos-titulo" className="flex items-center gap-2 text-xl font-bold text-gray-900">
          <BellRing size={22} aria-hidden="true" className="text-emerald-700" />
          {tituloDosAvisos(avisos.length)}
        </h2>

        <ul className="mt-4 space-y-3">
          {avisos.map((aviso) => (
            <li
              key={aviso.id}
              className={
                "rounded-xl border p-3 text-sm " +
                (aviso.kind === "REMOVED"
                  ? "border-amber-200 bg-amber-50 text-amber-900"
                  : "border-emerald-200 bg-emerald-50 text-emerald-900")
              }
            >
              {textoDoAviso(aviso)}
            </li>
          ))}
        </ul>

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            className="rounded-lg bg-[#006ee8] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#005fc9] focus:outline-none focus:ring-4 focus:ring-[#b8dcff]"
          >
            Entendi
          </button>
        </div>
      </div>
    </dialog>
  );
}
