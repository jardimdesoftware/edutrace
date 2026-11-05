'use client';

import { resumoDosPapeis, type Papeis } from '@/utils/papeis';
import { useEffect, useRef, useState } from 'react';

const PILULA =
  'inline-flex min-w-0 items-center rounded-full bg-[#ddf8ee] px-3 py-1 text-xs font-bold text-[#0b2455] shadow-[inset_0_0_0_1px_rgba(42,169,143,0.08)] sm:text-sm';

export default function PapeisTag({ roles, rotulo }: { roles: Papeis; rotulo?: string }) {
  const [aberto, setAberto] = useState(false);
  const raiz = useRef<HTMLSpanElement>(null);
  const { visiveis, ocultos } = resumoDosPapeis(roles);

  useEffect(() => {
    if (!aberto) return;
    const fecharFora = (evento: MouseEvent) => {
      if (!raiz.current?.contains(evento.target as Node)) setAberto(false);
    };
    const fecharComEsc = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') setAberto(false);
    };
    document.addEventListener('mousedown', fecharFora);
    document.addEventListener('keydown', fecharComEsc);
    return () => {
      document.removeEventListener('mousedown', fecharFora);
      document.removeEventListener('keydown', fecharComEsc);
    };
  }, [aberto]);

  const todos = [...visiveis, ...ocultos];
  const textos = rotulo ? [rotulo] : visiveis;
  const textosOcultos = rotulo ? [] : ocultos;
  const descricao = rotulo ?? (todos.join(', ') || 'Não informado');

  return (
    <span
      ref={raiz}
      className="relative inline-flex min-w-0 max-w-full items-center gap-1.5"
      role="group"
      aria-label={`Perfil: ${descricao}`}
    >
      {textos.length === 0 && <span className={PILULA}>Não informado</span>}
      {textos.map((texto) => (
        <span key={texto} className={`${PILULA} truncate`} title={texto}>
          {texto}
        </span>
      ))}

      {textosOcultos.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setAberto((atual) => !atual)}
            aria-expanded={aberto}
            aria-label={`Mais ${textosOcultos.length} ${textosOcultos.length === 1 ? 'papel' : 'papéis'}`}
            className={`${PILULA} shrink-0 cursor-pointer outline-none hover:bg-[#c8f1e1] focus-visible:ring-4 focus-visible:ring-[#b8dcff]`}
          >
            +{textosOcultos.length}
          </button>

          {aberto && (
            <ul className="absolute right-0 top-full z-20 mt-2 flex w-max max-w-[18rem] flex-col gap-1.5 rounded-2xl border border-[#bfd3ec] bg-white p-3 shadow-lg">
              {todos.map((texto) => (
                <li key={texto} className="text-xs font-bold text-[#0b2455] sm:text-sm">
                  {texto}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </span>
  );
}
