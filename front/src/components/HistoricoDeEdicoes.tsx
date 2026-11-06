"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { History } from "lucide-react";
import { buscarVersao, listarVersoes } from "@/api/formRevisions";
import {
  MAXIMO_DE_VERSOES,
  MENSAGEM_DE_LIMITE,
  formatarDataEHora,
  limiteDeVersoesAtingido,
  ordenarDaMaisRecente,
  podeVerHistorico,
  resumoDeAutoria,
  type TipoDeFormulario,
  type VersaoCompleta,
  type VersaoResumida,
} from "@/utils/historicoDeEdicoes";
import type { Papeis } from "@/utils/papeis";
import { BOTAO_SECUNDARIO } from "./form/botoes";

export interface HistoricoDeEdicoesProps<T> {
  tipo: TipoDeFormulario;
  // Ainda indefinido enquanto a tela descobre o estudante.
  email: string | null | undefined;
  // Período letivo, só no PAEE.
  periodo?: string;
  roles: Papeis;
  // Muda quando o formulário é salvo, para a lista ser buscada de novo.
  atualizadoEm?: string | null;
  versaoAberta: number | null;
  // null devolve a tela à versão atual.
  onEscolher: (versao: VersaoCompleta<T> | null) => void;
}

export interface PecasDoHistorico {
  // "Criado por ... em ..." e a última edição, em uma linha.
  autoria: ReactNode;
  // O botão do histórico, com o modal das versões.
  botao: ReactNode;
}

// Busca as versões do formulário e entrega a autoria e o botão do histórico em
// peças separadas, para a tela pôr cada uma no seu lugar. Quem não pode ler o
// histórico, e o formulário que ainda não tem versões, recebem null nas duas.
export function useHistoricoDeEdicoes<T>({
  tipo,
  email,
  periodo,
  roles,
  atualizadoEm,
  versaoAberta,
  onEscolher,
}: HistoricoDeEdicoesProps<T>): PecasDoHistorico {
  const permitido = podeVerHistorico(tipo, roles);
  const [versoes, setVersoes] = useState<VersaoResumida[]>([]);
  const [modalAberto, setModalAberto] = useState(false);
  const [abrindo, setAbrindo] = useState<number | null>(null);
  const [falha, setFalha] = useState<string | null>(null);

  useEffect(() => {
    if (!permitido || !email) return;

    let ativo = true;
    listarVersoes(tipo, email, periodo)
      .then((lista) => {
        if (ativo) setVersoes(lista);
      })
      .catch((error) => {
        // O histórico é complementar: sem ele a tela do formulário segue normal.
        console.error("Não foi possível carregar o histórico de edições.", error);
        if (ativo) setVersoes([]);
      });

    return () => {
      ativo = false;
    };
  }, [permitido, tipo, email, periodo, atualizadoEm]);

  const resumo = resumoDeAutoria(versoes);
  if (!permitido || !resumo || !email) return { autoria: null, botao: null };

  const maisRecente = Math.max(...versoes.map((v) => v.version));

  const escolher = async (versao: number) => {
    setFalha(null);
    if (versao === maisRecente) {
      onEscolher(null);
      setModalAberto(false);
      return;
    }

    setAbrindo(versao);
    try {
      onEscolher(await buscarVersao<T>(tipo, email, versao, periodo));
      setModalAberto(false);
    } catch (error) {
      console.error("Não foi possível abrir a versão do formulário.", error);
      setFalha("Não foi possível abrir esta versão. Tente novamente.");
    } finally {
      setAbrindo(null);
    }
  };

  return {
    autoria: (
      <div
        aria-label="Autoria do formulário"
        className="flex flex-wrap items-baseline gap-x-4 gap-y-0.5 text-sm text-gray-700"
      >
        <span>
          Criado por <strong>{resumo.criadoPor}</strong> em {resumo.criadoEm}
        </span>
        {resumo.editadoPor && (
          <span>
            Última edição por <strong>{resumo.editadoPor}</strong> em {resumo.editadoEm}
          </span>
        )}
      </div>
    ),
    botao: (
      <>
        <button type="button" className={BOTAO_SECUNDARIO} onClick={() => setModalAberto(true)}>
          <History size={16} aria-hidden="true" />
          Histórico de edições
        </button>
        {modalAberto && (
          <ModalDoHistorico
            versoes={ordenarDaMaisRecente(versoes)}
            maisRecente={maisRecente}
            versaoAberta={versaoAberta}
            abrindo={abrindo}
            falha={falha}
            limiteAtingido={limiteDeVersoesAtingido(versoes)}
            onEscolher={escolher}
            onFechar={() => setModalAberto(false)}
          />
        )}
      </>
    ),
  };
}

// Autoria e botão juntos, para as telas que não têm um cabeçalho próprio (o PAEE,
// que mostra um bloco por período letivo).
export default function HistoricoDeEdicoes<T>(props: HistoricoDeEdicoesProps<T>) {
  const { autoria, botao } = useHistoricoDeEdicoes(props);
  if (!autoria) return null;

  return (
    <section aria-label="Histórico do formulário" className="flex flex-wrap items-center gap-x-6 gap-y-2">
      {autoria}
      {botao}
    </section>
  );
}

interface ModalDoHistoricoProps {
  versoes: VersaoResumida[];
  maisRecente: number;
  versaoAberta: number | null;
  abrindo: number | null;
  falha: string | null;
  limiteAtingido: boolean;
  onEscolher: (versao: number) => void;
  onFechar: () => void;
}

function ModalDoHistorico({
  versoes,
  maisRecente,
  versaoAberta,
  abrindo,
  falha,
  limiteAtingido,
  onEscolher,
  onFechar,
}: ModalDoHistoricoProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="historico-titulo"
      onClose={onFechar}
      onClick={(evento) => {
        if (evento.target === evento.currentTarget) onFechar();
      }}
      className="m-auto w-[min(36rem,calc(100vw-2rem))] max-h-[calc(100vh-2rem)] overflow-y-auto rounded-2xl border border-[#dce8f4] bg-white p-0 text-left shadow-[0_14px_40px_rgba(28,67,112,0.18)] backdrop:bg-slate-900/40"
    >
      <div className="p-5 sm:p-7">
        <h2 id="historico-titulo" className="text-xl font-bold text-gray-900">
          Histórico de edições ({versoes.length} de {MAXIMO_DE_VERSOES})
        </h2>
        <p className="mt-1 text-sm text-gray-600">
          Escolha uma versão para abrir o formulário como ele estava naquele momento.
        </p>

        {limiteAtingido && (
          <p
            role="status"
            className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
          >
            {MENSAGEM_DE_LIMITE}
          </p>
        )}
        {falha && (
          <p
            role="alert"
            className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
          >
            {falha}
          </p>
        )}

        <ul className="mt-4 space-y-2">
          {versoes.map((versao) => {
            const atual = versao.version === maisRecente;
            const emExibicao = versaoAberta === null ? atual : versaoAberta === versao.version;

            return (
              <li key={versao.version}>
                <button
                  type="button"
                  onClick={() => onEscolher(versao.version)}
                  disabled={abrindo !== null}
                  aria-current={emExibicao ? "true" : undefined}
                  className={
                    "flex w-full flex-col items-start gap-0.5 rounded-xl border p-3 text-left focus:outline-none focus:ring-2 focus:ring-emerald-600 disabled:opacity-60 " +
                    (emExibicao
                      ? "border-emerald-600 bg-emerald-50"
                      : "border-gray-200 hover:bg-gray-50")
                  }
                >
                  <span className="font-semibold text-gray-900">
                    Versão {versao.version}
                    {atual && " (atual)"}
                    {versao.version === 1 && " · criação"}
                  </span>
                  <span className="text-sm text-gray-700">
                    {formatarDataEHora(versao.created_at)} · {versao.author_name}
                  </span>
                  {abrindo === versao.version && (
                    <span className="text-xs text-gray-500">Abrindo...</span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={onFechar}
            className="rounded-lg bg-[#006ee8] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#005fc9] focus:outline-none focus:ring-4 focus:ring-[#b8dcff]"
          >
            Fechar
          </button>
        </div>
      </div>
    </dialog>
  );
}
