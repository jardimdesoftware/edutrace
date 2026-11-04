"use client";

import { atualizarCursoDoEstudante } from "@/api/students";
import type { StudentData } from "@/interfaces/StudentData";
import { CURSOS, ehCurso } from "@/utils/cursos";
import { errorAlertOptions } from "@/utils/errorAlert";
import { useId, useState } from "react";
import Swal from "sweetalert2";

const COR_CONFIRMAR = "#006ee8";

interface CursoDoEstudanteProps {
  estudante: StudentData;
  onAtualizado: (estudante: StudentData) => void;
}

// Seletor do curso, só para quem pode alterá-lo (o NAPNE). Um curso gravado
// antes da lista existir (texto livre) não aparece como opção: o seletor começa
// vazio e o valor antigo fica visível ao lado, até a pessoa escolher um da lista.
export default function CursoDoEstudante({
  estudante,
  onAtualizado,
}: CursoDoEstudanteProps) {
  const id = useId();
  const atual = estudante.course ?? "";
  const [escolhido, setEscolhido] = useState(ehCurso(atual) ? atual : "");
  const [salvando, setSalvando] = useState(false);

  const foraDaLista = atual !== "" && !ehCurso(atual);
  const podeSalvar = escolhido !== "" && escolhido !== atual && !salvando;

  const salvar = async () => {
    setSalvando(true);
    try {
      const atualizado = await atualizarCursoDoEstudante(estudante.email, escolhido);
      onAtualizado(atualizado);
      await Swal.fire({
        icon: "success",
        title: "Curso atualizado com sucesso!",
        confirmButtonColor: COR_CONFIRMAR,
        confirmButtonText: "Ok",
      });
    } catch (error) {
      console.error(error);
      await Swal.fire({
        ...errorAlertOptions(
          "Falha ao atualizar o curso",
          error,
          "Não foi possível atualizar o curso.",
        ),
        confirmButtonColor: COR_CONFIRMAR,
        confirmButtonText: "Entendi",
      });
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label htmlFor={id} className="sr-only">
        Curso de {estudante.full_name}
      </label>
      <select
        id={id}
        value={escolhido}
        onChange={(e) => setEscolhido(e.target.value)}
        disabled={salvando}
        className="min-w-0 max-w-full rounded border border-gray-300 px-2 py-1 text-sm"
      >
        <option value="">Selecione o curso</option>
        {CURSOS.map((curso) => (
          <option key={curso} value={curso}>
            {curso}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={salvar}
        disabled={!podeSalvar}
        className="rounded-lg bg-[#006ee8] px-3 py-1 text-sm font-semibold text-white transition-colors hover:bg-[#005fc9] focus:outline-none focus:ring-4 focus:ring-[#b8dcff] disabled:opacity-60"
      >
        {salvando ? "Salvando..." : "Salvar curso"}
      </button>
      {foraDaLista && (
        <p className="w-full text-xs text-gray-600">
          Valor atual fora da lista: {atual}
        </p>
      )}
    </div>
  );
}
