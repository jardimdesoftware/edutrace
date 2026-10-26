"use client";

import { useState } from "react";
import { PAPEIS_DO_FORMULARIO, estadoDoRascunhoDePapeis } from "@/utils/papeis";
import SeletorDePapeis from "./SeletorDePapeis";

interface EditorDePapeisProps {
  idBase: string;
  nome: string;
  gravado: readonly number[];
  legendaOculta?: boolean;
  onSalvar: (papeis: number[]) => Promise<void>;
}

// Rascunho dos papéis de uma linha: as caixas mexem só no rascunho e um único
// envio grava a lista final. Quem usa remonta o editor (key) quando os papéis
// gravados mudam, o que zera o rascunho.
export default function EditorDePapeis({
  idBase,
  nome,
  gravado,
  legendaOculta = false,
  onSalvar,
}: EditorDePapeisProps) {
  const [rascunho, setRascunho] = useState<number[]>([...gravado]);
  const [salvando, setSalvando] = useState(false);
  const { alterado, erro, podeSalvar } = estadoDoRascunhoDePapeis(gravado, rascunho);
  const idErro = `${idBase}-erro`;

  const salvar = async () => {
    setSalvando(true);
    try {
      await onSalvar(rascunho);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div>
      <SeletorDePapeis
        legenda={`Papéis de ${nome}`}
        legendaOculta={legendaOculta}
        opcoes={PAPEIS_DO_FORMULARIO}
        valor={rascunho}
        onChange={setRascunho}
        desabilitado={salvando}
        descritoPor={erro ? idErro : undefined}
      />
      {erro && (
        <p id={idErro} role="alert" className="mt-1 text-sm text-red-700">
          {erro}
        </p>
      )}
      {alterado && (
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            disabled={!podeSalvar || salvando}
            onClick={salvar}
            className="rounded bg-emerald-700 px-3 py-1 text-sm font-medium text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Salvar papéis
          </button>
          <button
            type="button"
            disabled={salvando}
            onClick={() => setRascunho([...gravado])}
            className="rounded border px-3 py-1 text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancelar
          </button>
        </div>
      )}
    </div>
  );
}
