"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { PAPEIS_DO_FORMULARIO, estadoDoRascunhoDePapeis, rotulosDosPapeis } from "@/utils/papeis";
import { posicaoDoPainel } from "@/utils/posicaoDoPainel";
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
// gravados mudam, o que zera o rascunho. As caixas ficam num painel que flutua
// sobre a tabela (position: fixed, fora do fluxo), então abrir a lista não muda
// a altura da linha nem a largura das colunas; fechada, ela mostra os papéis do
// rascunho. O painel fecha ao rolar, redimensionar, clicar fora ou apertar Esc.
export default function EditorDePapeis({
  idBase,
  nome,
  gravado,
  legendaOculta = false,
  onSalvar,
}: EditorDePapeisProps) {
  const [rascunho, setRascunho] = useState<number[]>([...gravado]);
  const [salvando, setSalvando] = useState(false);
  const [aberto, setAberto] = useState(false);
  const [posicao, setPosicao] = useState<{ top: number; left: number } | null>(null);
  const detalhes = useRef<HTMLDetailsElement>(null);
  const painel = useRef<HTMLDivElement>(null);
  const { alterado, erro, podeSalvar } = estadoDoRascunhoDePapeis(gravado, rascunho);
  const idErro = `${idBase}-erro`;

  // Mede o painel já desenhado (invisível até ter posição) e o encaixa junto ao
  // gatilho, para cima ou para baixo conforme o espaço da janela.
  useLayoutEffect(() => {
    if (!aberto || !detalhes.current || !painel.current) {
      setPosicao(null);
      return;
    }

    const gatilho = detalhes.current.getBoundingClientRect();
    setPosicao(
      posicaoDoPainel(
        gatilho,
        { width: painel.current.offsetWidth, height: painel.current.offsetHeight },
        { width: window.innerWidth, height: window.innerHeight },
      ),
    );
  }, [aberto]);

  useEffect(() => {
    if (!aberto) return;

    const fechar = () => {
      detalhes.current?.removeAttribute("open");
      setAberto(false);
    };
    const aoClicar = (evento: MouseEvent) => {
      if (!detalhes.current?.contains(evento.target as Node)) fechar();
    };
    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.key !== "Escape") return;
      fechar();
      detalhes.current?.querySelector("summary")?.focus();
    };

    window.addEventListener("scroll", fechar, true);
    window.addEventListener("resize", fechar);
    document.addEventListener("mousedown", aoClicar);
    document.addEventListener("keydown", aoTeclar);

    return () => {
      window.removeEventListener("scroll", fechar, true);
      window.removeEventListener("resize", fechar);
      document.removeEventListener("mousedown", aoClicar);
      document.removeEventListener("keydown", aoTeclar);
    };
  }, [aberto]);

  const salvar = async () => {
    setSalvando(true);
    try {
      await onSalvar(rascunho);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="max-w-56">
      <details
        ref={detalhes}
        onToggle={(evento) => setAberto(evento.currentTarget.open)}
        className="rounded border border-gray-300 bg-white"
      >
        <summary className="cursor-pointer px-2 py-1 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#006ee8]">
          <span className="sr-only">{`Alterar os papéis de ${nome}: `}</span>
          {rotulosDosPapeis(rascunho).join(", ") || "Nenhum papel"}
        </summary>
        <div
          ref={painel}
          style={posicao ? { top: posicao.top, left: posicao.left } : { visibility: "hidden" }}
          className="fixed z-50 w-64 rounded border border-gray-300 bg-white shadow-lg"
        >
          <SeletorDePapeis
            legenda={`Papéis de ${nome}`}
            legendaOculta={legendaOculta}
            opcoes={PAPEIS_DO_FORMULARIO}
            valor={rascunho}
            onChange={setRascunho}
            desabilitado={salvando}
            descritoPor={erro ? idErro : undefined}
            className="px-2 py-1"
          />
        </div>
      </details>
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
