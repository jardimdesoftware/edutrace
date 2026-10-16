"use client";

import {
  LIMITE_ATENDIMENTO_MAX,
  validarLimiteAtendimento,
} from "@/utils/limiteAtendimento";
import { FormEvent, useState } from "react";

interface LimiteAtendimentoProps {
  nome: string;
  limiteAtual?: number | null;
  onSalvar: (limite: number) => Promise<boolean>;
}

export default function LimiteAtendimento({
  nome,
  limiteAtual,
  onSalvar,
}: LimiteAtendimentoProps) {
  const [rascunho, setRascunho] = useState(limiteAtual == null ? "" : String(limiteAtual));
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const handleSubmit = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();

    const resultado = validarLimiteAtendimento(rascunho);
    if (!resultado.ok) {
      setErro(resultado.error);
      return;
    }

    setErro(null);
    setSalvando(true);
    try {
      if (await onSalvar(resultado.value)) {
        setRascunho(String(resultado.value));
      }
    } finally {
      setSalvando(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-1">
      <p className="text-xs text-gray-600">
        Atual: {limiteAtual == null ? "Não definido" : limiteAtual}
      </p>
      <div className="flex items-center gap-2">
        <input
          type="number"
          inputMode="numeric"
          min={0}
          max={LIMITE_ATENDIMENTO_MAX}
          step={1}
          value={rascunho}
          onChange={(e) => setRascunho(e.target.value)}
          aria-label={`Limite de atendimento de ${nome}`}
          aria-invalid={erro ? true : undefined}
          className="w-20 border rounded px-2 py-1"
        />
        <button
          type="submit"
          disabled={salvando}
          className="rounded bg-emerald-700 px-3 py-1 text-sm font-medium text-white transition-colors hover:bg-emerald-800 disabled:opacity-60"
        >
          Salvar
        </button>
      </div>
      {erro && (
        <p role="alert" className="text-xs text-red-700">
          {erro}
        </p>
      )}
    </form>
  );
}
