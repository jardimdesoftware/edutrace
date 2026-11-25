"use client";

import { editarDadosDoUsuario } from "@/api/user";
import { ESTUDANTE } from "@/consts";
import type { StudentData } from "@/interfaces/StudentData";
import {
  alteracoesDaEdicao,
  camposIniciais,
  type CamposDaEdicao,
} from "@/utils/edicaoDeDados";
import { CURSOS, ehCurso } from "@/utils/cursos";
import { errorAlertOptions } from "@/utils/errorAlert";
import { temPapel } from "@/utils/papeis";
import { type FormEvent, useEffect, useRef, useState } from "react";
import Swal from "sweetalert2";

const COR_CONFIRMAR = "#047857";
const CLASSE_CAMPO =
  "mt-1 h-11 w-full rounded-lg border border-[#a9c5e8] bg-white px-3 text-sm outline-none transition focus:border-[#006ee8] focus:ring-4 focus:ring-[#dcecff]";

interface EditarDadosDoUsuarioModalProps {
  usuario: StudentData;
  onClose: () => void;
  onAtualizado: (usuario: StudentData) => void;
}

export default function EditarDadosDoUsuarioModal({
  usuario,
  onClose,
  onAtualizado,
}: EditarDadosDoUsuarioModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [campos, setCampos] = useState<CamposDaEdicao>(() => camposIniciais(usuario));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const ehEstudante = temPapel(usuario.roles, ESTUDANTE);

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  const alterar = (campo: keyof CamposDaEdicao) =>
    (evento: { target: { value: string } }) =>
      setCampos((anteriores) => ({ ...anteriores, [campo]: evento.target.value }));

  const salvar = async (evento: FormEvent) => {
    evento.preventDefault();
    const alteracoes = alteracoesDaEdicao(usuario, campos, ehEstudante);
    if (Object.keys(alteracoes).length === 0) {
      onClose();
      return;
    }

    setSalvando(true);
    setErro(null);
    try {
      const atualizado = await editarDadosDoUsuario(usuario.email, alteracoes);
      onAtualizado(atualizado);
      onClose();
      await Swal.fire({
        icon: "success",
        title: "Dados atualizados com sucesso!",
        text: alteracoes.email
          ? "As sessões abertas da conta foram encerradas: a pessoa entra de novo com o e-mail novo."
          : undefined,
        confirmButtonColor: COR_CONFIRMAR,
        confirmButtonText: "Ok",
      });
    } catch (error) {
      console.error(error);
      // O <dialog> aberto fica na camada de cima da página e esconderia o alerta
      // do SweetAlert2; o erro aparece dentro do próprio modal.
      setErro(
        errorAlertOptions(
          "Falha ao atualizar os dados",
          error,
          "Não foi possível atualizar os dados do usuário.",
        ).text,
      );
    } finally {
      setSalvando(false);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="editar-dados-titulo"
      onClose={onClose}
      className="m-auto w-[min(40rem,calc(100vw-2rem))] max-h-[calc(100vh-2rem)] overflow-y-auto rounded-2xl border border-[#dce8f4] bg-white p-0 text-left shadow-[0_14px_40px_rgba(28,67,112,0.18)] backdrop:bg-slate-900/40"
    >
      <form onSubmit={salvar} className="p-5 sm:p-7">
        <h2 id="editar-dados-titulo" className="text-xl font-bold text-[#0b2455]">
          Editar dados
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Corrija os dados de {usuario.full_name} cadastrados com erro.
        </p>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-semibold text-[#0b2455] sm:col-span-2">
            Nome
            <input required value={campos.full_name} onChange={alterar("full_name")} className={CLASSE_CAMPO} />
          </label>
          <label className="text-sm font-semibold text-[#0b2455] sm:col-span-2">
            E-mail
            <input type="email" required value={campos.email} onChange={alterar("email")} className={CLASSE_CAMPO} />
          </label>
          <label className="text-sm font-semibold text-[#0b2455] sm:col-span-2">
            CPF
            <input
              inputMode="numeric"
              value={campos.cpf}
              onChange={alterar("cpf")}
              placeholder={`Atual: ${usuario.cpf}. Deixe em branco para manter.`}
              className={CLASSE_CAMPO}
            />
          </label>
          {ehEstudante && (
            <>
              <label className="text-sm font-semibold text-[#0b2455]">
                Matrícula
                <input value={campos.enrollment_number} onChange={alterar("enrollment_number")} className={CLASSE_CAMPO} />
              </label>
              <label className="text-sm font-semibold text-[#0b2455]">
                Curso
                <select
                  value={ehCurso(campos.course) ? campos.course : ""}
                  onChange={alterar("course")}
                  className={CLASSE_CAMPO}
                >
                  <option value="">Selecione o curso</option>
                  {CURSOS.map((curso) => (
                    <option key={curso} value={curso}>
                      {curso}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}
        </div>

        {erro && (
          <p role="alert" className="mt-5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {erro}
          </p>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={salvando}
            className="rounded-lg bg-[#006ee8] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#005fc9] focus:outline-none focus:ring-4 focus:ring-[#b8dcff] disabled:opacity-60"
          >
            {salvando ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
