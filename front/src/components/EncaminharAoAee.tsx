"use client";

import { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import Swal from "sweetalert2";
import { encaminharEstudante } from "@/api/aeeReferrals";
import { getServiceStats } from "@/api/serviceStats";
import { useAuth } from "@/contexts/AuthContext";
import type { ProfessionalLoad } from "@/interfaces/ServiceStats";
import {
  podeEncaminhar,
  podeEscolherProfessor,
  textoDaConfirmacaoDoEncaminhamento,
  textoDaDisponibilidade,
} from "@/utils/encaminhamentoAee";
import { errorAlertOptions } from "@/utils/errorAlert";
import { BOTAO_SECUNDARIO, COR_CANCELAR, COR_CONFIRMAR } from "./form/botoes";

interface EncaminharAoAeeProps {
  email: string;
  nome: string | null;
}

// A opção "Encaminhar ao AEE" da última página da anamnese. Só o NAPNE a vê. A
// lista de professores traz a disponibilidade de cada um, e quem está com o
// limite de atendimentos aparece bloqueado.
export default function EncaminharAoAee({ email, nome }: EncaminharAoAeeProps) {
  const { user } = useAuth();
  const [aberto, setAberto] = useState(false);

  if (!podeEncaminhar(user?.roles)) return null;

  return (
    <section aria-label="Encaminhamento ao AEE" className="space-y-3 rounded-2xl border border-gray-200 bg-gray-50 p-4">
      <h3 className="text-base font-semibold text-gray-900">Encaminhamento</h3>
      <p className="text-sm text-gray-700">
        Encaminhe o estudante a um Professor do AEE. Ele passa a ser atendido pelo professor escolhido, que recebe um aviso no próximo acesso.
      </p>
      <button type="button" className={BOTAO_SECUNDARIO} onClick={() => setAberto(true)}>
        <Send size={16} aria-hidden="true" />
        Encaminhar ao AEE
      </button>
      {aberto && <ListaDeProfessores email={email} nome={nome} onFechar={() => setAberto(false)} />}
    </section>
  );
}

interface ListaDeProfessoresProps extends EncaminharAoAeeProps {
  onFechar: () => void;
}

function ListaDeProfessores({ email, nome, onFechar }: ListaDeProfessoresProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [professores, setProfessores] = useState<ProfessionalLoad[] | null>(null);
  const [falha, setFalha] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  useEffect(() => {
    let ativo = true;
    getServiceStats()
      .then((estatisticas) => {
        if (ativo) setProfessores(estatisticas.professionals);
      })
      .catch((error) => {
        console.error("Não foi possível carregar os professores do AEE.", error);
        if (ativo) setFalha("Não foi possível carregar os professores do AEE. Tente novamente.");
      });

    return () => {
      ativo = false;
    };
  }, []);

  const escolher = async (professor: ProfessionalLoad) => {
    const confirmacao = await Swal.fire({
      icon: "question",
      title: "Encaminhar ao AEE",
      text: textoDaConfirmacaoDoEncaminhamento(nome, professor.full_name),
      showCancelButton: true,
      confirmButtonColor: COR_CONFIRMAR,
      cancelButtonColor: COR_CANCELAR,
      confirmButtonText: "Sim, encaminhar",
      cancelButtonText: "Cancelar",
    });
    if (!confirmacao.isConfirmed) return;

    setEnviando(true);
    try {
      await encaminharEstudante(email, professor.id);
    } catch (error) {
      console.error("Erro ao encaminhar o estudante:", error);
      await Swal.fire({
        ...errorAlertOptions("Falha ao encaminhar", error, "Não foi possível encaminhar o estudante."),
        confirmButtonColor: COR_CONFIRMAR,
        confirmButtonText: "Entendi",
      });
      setEnviando(false);
      // O limite pode ter mudado desde que a lista abriu.
      getServiceStats().then((e) => setProfessores(e.professionals)).catch(() => undefined);
      return;
    }

    setEnviando(false);
    onFechar();
    Swal.fire({
      icon: "success",
      title: "Estudante encaminhado",
      text: `${professor.full_name} recebeu o estudante e vai ver o aviso no próximo acesso.`,
      confirmButtonColor: COR_CONFIRMAR,
      confirmButtonText: "Ok",
    });
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="encaminhar-titulo"
      onClose={onFechar}
      onClick={(evento) => {
        if (evento.target === evento.currentTarget) onFechar();
      }}
      className="m-auto w-[min(36rem,calc(100vw-2rem))] max-h-[calc(100vh-2rem)] overflow-y-auto rounded-2xl border border-[#dce8f4] bg-white p-0 text-left shadow-[0_14px_40px_rgba(28,67,112,0.18)] backdrop:bg-slate-900/40"
    >
      <div className="p-5 sm:p-7">
        <h2 id="encaminhar-titulo" className="text-xl font-bold text-gray-900">
          Encaminhar ao AEE
        </h2>
        <p className="mt-1 text-sm text-gray-600">
          Escolha o professor. A disponibilidade mostra quantos estudantes cada um atende agora.
        </p>

        {falha && (
          <p role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {falha}
          </p>
        )}
        {!professores && !falha && <p className="mt-4 text-sm text-gray-600">Carregando professores...</p>}
        {professores?.length === 0 && (
          <p className="mt-4 text-sm text-gray-700">Nenhum Professor do AEE cadastrado.</p>
        )}

        <ul className="mt-4 space-y-2">
          {professores?.map((professor) => {
            const livre = podeEscolherProfessor(professor);

            return (
              <li key={professor.id} className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 p-3">
                <div>
                  <p className="font-semibold text-gray-900">{professor.full_name}</p>
                  <p className={livre ? "text-sm text-gray-700" : "text-sm font-medium text-red-700"}>
                    {textoDaDisponibilidade(professor)}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={!livre || enviando}
                  onClick={() => escolher(professor)}
                  className={BOTAO_SECUNDARIO + " disabled:cursor-not-allowed disabled:opacity-50"}
                >
                  {livre ? "Encaminhar" : "Sem vaga"}
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
