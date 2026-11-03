"use client";

import {
  getPedagogicalManagerOptions,
  updatePedagogicalManager,
} from "@/api/pedagogicalManager";
import type { PedagogicalManagerOption } from "@/interfaces/PedagogicalManager";
import type { StudentData } from "@/interfaces/StudentData";
import { errorAlertOptions } from "@/utils/errorAlert";
import {
  montarCorpoDoResponsavel,
  nomeDoResponsavel,
  rascunhoInicial,
  RESPONSAVEL_NOME_MAX,
  rotuloDaOpcao,
  type RascunhoResponsavel,
  type TipoResponsavel,
} from "@/utils/responsavelPedagogico";
import { FormEvent, useEffect, useId, useRef, useState } from "react";
import Swal from "sweetalert2";

const COR_CONFIRMAR = "#047857";
const COR_CANCELAR = "#6b7280";
const ERRO_LISTA = "Não foi possível carregar a lista de servidores.";

const TIPOS: readonly { valor: TipoResponsavel; rotulo: string }[] = [
  { valor: "SERVER", rotulo: "Servidor cadastrado" },
  { valor: "EXTERNAL", rotulo: "Pessoa externa" },
  { valor: "NONE", rotulo: "Remover responsável" },
];

const CAMPO = "block w-full rounded border border-gray-300 px-2 py-1";
const ROTULO = "block text-sm font-medium text-gray-800";

interface ResponsavelPedagogicoProps {
  estudante: StudentData;
  onAtualizado: (estudante: StudentData) => void;
}

// O responsável aparece como um botão no lugar do texto; o formulário abre num
// modal nativo (<dialog>), que prende o foco, fecha com Esc e devolve o foco ao
// botão. A lista de servidores só é pedida na primeira abertura, para a tabela
// não fazer uma chamada por linha. O SweetAlert2 fica fora do modal (o dialog
// aberto cobre qualquer elemento comum), então o modal fecha antes de cada alerta.
export default function ResponsavelPedagogico({
  estudante,
  onAtualizado,
}: ResponsavelPedagogicoProps) {
  const base = useId();
  const dialogo = useRef<HTMLDialogElement>(null);
  const [aberto, setAberto] = useState(false);
  const [jaAbriu, setJaAbriu] = useState(false);
  const [rascunho, setRascunho] = useState<RascunhoResponsavel>(() =>
    rascunhoInicial(estudante),
  );
  const [opcoes, setOpcoes] = useState<PedagogicalManagerOption[] | null>(null);
  const [erroLista, setErroLista] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const temResponsavel =
    !!estudante.pedagogical_manager || !!estudante.external_manager_name;
  const tipos = TIPOS.filter(({ valor }) => valor !== "NONE" || temResponsavel);
  const atualizarCampo = (campo: Partial<RascunhoResponsavel>) => {
    setErro(null);
    setRascunho((atual) => ({ ...atual, ...campo }));
  };

  useEffect(() => {
    if (!jaAbriu) return;
    let ativo = true;
    getPedagogicalManagerOptions()
      .then((lista) => {
        if (!ativo) return;
        setOpcoes(lista);
        // Um servidor que saiu da lista (mudou de nível) não fica escolhido sem
        // aparecer no campo.
        setRascunho((atual) =>
          lista.some((opcao) => String(opcao.id) === atual.servidorId)
            ? atual
            : { ...atual, servidorId: "" },
        );
      })
      .catch((error) => {
        console.error("Erro ao listar os servidores", error);
        if (ativo) setErroLista(error instanceof Error ? error.message : ERRO_LISTA);
      });
    return () => {
      ativo = false;
    };
  }, [jaAbriu]);

  useEffect(() => {
    const elemento = dialogo.current;
    if (!elemento) return;
    if (aberto && !elemento.open) elemento.showModal();
    if (!aberto && elemento.open) elemento.close();
  }, [aberto, jaAbriu]);

  const abrir = () => {
    const inicial = rascunhoInicial(estudante);
    const servidorValido = opcoes?.some((opcao) => String(opcao.id) === inicial.servidorId);
    setRascunho(opcoes && !servidorValido ? { ...inicial, servidorId: "" } : inicial);
    setErro(null);
    setJaAbriu(true);
    setAberto(true);
  };

  const fechar = () => {
    if (!salvando) setAberto(false);
  };

  const confirmarRemocao = async (): Promise<boolean> => {
    setAberto(false);
    const confirmacao = await Swal.fire({
      icon: "warning",
      title: "Remover responsável pedagógico",
      text: `Deseja remover o responsável pedagógico de "${estudante.full_name}"?`,
      showCancelButton: true,
      confirmButtonColor: COR_CONFIRMAR,
      cancelButtonColor: COR_CANCELAR,
      confirmButtonText: "Sim, remover",
      cancelButtonText: "Cancelar",
    });
    if (!confirmacao.isConfirmed) setAberto(true);
    return confirmacao.isConfirmed;
  };

  const handleSubmit = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();

    const corpo = montarCorpoDoResponsavel(rascunho);
    if (!corpo.ok) {
      setErro(corpo.error);
      return;
    }
    setErro(null);

    if (corpo.data.kind === "NONE" && !(await confirmarRemocao())) return;

    setSalvando(true);
    setAberto(false);
    try {
      const atualizado = await updatePedagogicalManager(estudante.email, corpo.data);
      onAtualizado(atualizado);
      setRascunho(rascunhoInicial(atualizado));
      Swal.fire({
        icon: "success",
        title: "Responsável pedagógico atualizado com sucesso!",
        confirmButtonColor: COR_CONFIRMAR,
        confirmButtonText: "Ok",
      });
    } catch (error) {
      console.error(error);
      await Swal.fire({
        ...errorAlertOptions(
          "Falha ao atualizar o responsável pedagógico",
          error,
          "Não foi possível atualizar o responsável pedagógico.",
        ),
        confirmButtonColor: COR_CONFIRMAR,
        confirmButtonText: "Entendi",
      });
      setAberto(true);
    } finally {
      setSalvando(false);
    }
  };

  const placeholderDaLista = opcoes
    ? "Selecione um servidor"
    : erroLista
      ? "Lista indisponível"
      : "Carregando servidores...";

  return (
    <>
      <button
        type="button"
        onClick={abrir}
        aria-haspopup="dialog"
        className="cursor-pointer text-left font-medium text-emerald-800 underline decoration-dotted underline-offset-4 hover:text-emerald-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
      >
        {nomeDoResponsavel(estudante)}
        <span className="sr-only">
          , alterar o responsável pedagógico de {estudante.full_name}
        </span>
      </button>

      {jaAbriu && (
        <dialog
          ref={dialogo}
          aria-labelledby={`${base}-titulo`}
          onClose={() => setAberto(false)}
          onClick={(evento) => {
            if (evento.target === evento.currentTarget) fechar();
          }}
          className="m-auto max-h-[90vh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-lg bg-white p-0 text-gray-900 shadow-xl backdrop:bg-black/50 [&_h2]:m-0! [&_h2]:p-0! [&_h2]:text-lg! [&_h2]:font-semibold! [&_p]:m-0!"
        >
          <header className="border-b border-gray-200 bg-emerald-50 px-6 py-4">
            <h2 id={`${base}-titulo`} className="text-lg font-semibold text-green-900">
              Responsável pedagógico
            </h2>
            <p className="text-sm! text-gray-700">{estudante.full_name}</p>
          </header>

          <form onSubmit={handleSubmit} noValidate className="m-0! space-y-4 px-6! py-4!">
            <div className="space-y-1 text-sm [&_p]:text-sm!">
              <p>
                <span className="font-semibold">Responsável atual:</span>{" "}
                {nomeDoResponsavel(estudante)}
              </p>
              {estudante.external_manager_name && estudante.external_manager_phone && (
                <p>
                  <span className="font-semibold">Telefone:</span>{" "}
                  {estudante.external_manager_phone}
                </p>
              )}
              {estudante.external_manager_name && estudante.external_manager_cpf && (
                <p>
                  <span className="font-semibold">CPF:</span>{" "}
                  {estudante.external_manager_cpf}
                </p>
              )}
            </div>

            <fieldset className="space-y-1">
              <legend className="text-sm font-medium text-gray-800">
                Tipo de responsável
              </legend>
              <div className="flex flex-wrap gap-x-6 gap-y-1">
                {tipos.map(({ valor, rotulo }) => (
                  <label key={valor} className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name={`${base}-tipo`}
                      value={valor}
                      checked={rascunho.tipo === valor}
                      onChange={() => atualizarCampo({ tipo: valor })}
                      className="accent-emerald-700"
                    />
                    {rotulo}
                  </label>
                ))}
              </div>
            </fieldset>

            {rascunho.tipo === "SERVER" && (
              <div className="space-y-1">
                <label htmlFor={`${base}-servidor`} className={ROTULO}>
                  Servidor responsável
                </label>
                <select
                  id={`${base}-servidor`}
                  value={rascunho.servidorId}
                  onChange={(e) => atualizarCampo({ servidorId: e.target.value })}
                  disabled={!opcoes}
                  className={CAMPO}
                >
                  <option value="">{placeholderDaLista}</option>
                  {opcoes?.map((opcao) => (
                    <option key={opcao.id} value={String(opcao.id)}>
                      {rotuloDaOpcao(opcao)}
                    </option>
                  ))}
                </select>
                {erroLista && (
                  <p role="alert" className="text-xs! text-red-700">
                    {erroLista}
                  </p>
                )}
              </div>
            )}

            {rascunho.tipo === "EXTERNAL" && (
              <div className="space-y-3">
                <div className="space-y-1">
                  <label htmlFor={`${base}-nome`} className={ROTULO}>
                    Nome completo
                  </label>
                  <input
                    id={`${base}-nome`}
                    type="text"
                    maxLength={RESPONSAVEL_NOME_MAX}
                    autoComplete="off"
                    value={rascunho.nome}
                    onChange={(e) => atualizarCampo({ nome: e.target.value })}
                    className={CAMPO}
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor={`${base}-telefone`} className={ROTULO}>
                    Telefone com DDD
                  </label>
                  <input
                    id={`${base}-telefone`}
                    type="tel"
                    inputMode="tel"
                    autoComplete="off"
                    placeholder="(11) 98765-4321"
                    value={rascunho.telefone}
                    onChange={(e) => atualizarCampo({ telefone: e.target.value })}
                    className={CAMPO}
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor={`${base}-cpf`} className={ROTULO}>
                    CPF
                  </label>
                  <input
                    id={`${base}-cpf`}
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="000.000.000-00"
                    aria-describedby={`${base}-cpf-ajuda`}
                    value={rascunho.cpf}
                    onChange={(e) => atualizarCampo({ cpf: e.target.value })}
                    className={CAMPO}
                  />
                  <p id={`${base}-cpf-ajuda`} className="text-xs! text-gray-600">
                    O CPF cadastrado não é exibido por inteiro: informe-o sempre que
                    salvar os dados da pessoa externa.
                  </p>
                </div>
              </div>
            )}

            {rascunho.tipo === "NONE" && (
              <p className="text-sm! text-gray-700">
                O estudante ficará sem responsável pedagógico.
              </p>
            )}

            {erro && (
              <p role="alert" className="text-sm! text-red-700">
                {erro}
              </p>
            )}

            <div className="flex justify-end gap-2 border-t border-gray-200 pt-4">
              <button
                type="button"
                onClick={fechar}
                disabled={salvando}
                className="rounded border border-gray-300 px-3 py-1 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-60"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={salvando}
                className="rounded bg-emerald-700 px-3 py-1 text-sm font-medium text-white transition-colors hover:bg-emerald-800 disabled:opacity-60"
              >
                {rascunho.tipo === "NONE" ? "Remover responsável" : "Salvar responsável"}
              </button>
            </div>
          </form>
        </dialog>
      )}
    </>
  );
}
