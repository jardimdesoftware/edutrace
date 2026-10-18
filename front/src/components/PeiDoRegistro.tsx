import { Pencil, Trash2 } from "lucide-react";
import type { PeiEntry } from "@/interfaces/PeiEntry";
import { NAO_INFORMADO } from "@/utils/formularioPorTabela";
import { secoesDoPeiParaLeitura } from "@/utils/pei";
import LeituraPorTabela from "./LeituraPorTabela";
import { BOTAO_PERIGO, BOTAO_PRIMARIO } from "./form/botoes";

interface PeiDoRegistroProps {
  registro: PeiEntry;
  aberto: boolean;
  podeEditar: boolean;
  podeExcluir: boolean;
  onEditar: () => void;
  onExcluir: () => void;
}

// O registro do PEI de uma disciplina, recolhível: o estudante acumula vários
// por semestre, e só os do semestre mais recente abrem de início. Editar é só do
// professor autor; Excluir também aparece para qualquer professor quando o autor
// foi excluído. A disciplina entra no nome dos botões porque a página repete
// "Editar" e "Excluir" em cada registro.
export default function PeiDoRegistro({
  registro,
  aberto,
  podeEditar,
  podeExcluir,
  onEditar,
  onExcluir,
}: PeiDoRegistroProps) {
  const identificacao = `${registro.subject}, semestre ${registro.semester}`;

  return (
    <details open={aberto} className="rounded-2xl border border-gray-200 bg-gray-50 p-4 sm:p-5">
      <summary className="cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600">
        <h3 className="inline text-lg font-semibold text-gray-900">{registro.subject}</h3>{" "}
        <span className="ml-1 text-sm text-gray-600">
          Professor(a): {registro.author?.full_name?.trim() || NAO_INFORMADO}
        </span>
      </summary>
      <div className="mt-4 space-y-4">
        {(podeEditar || podeExcluir) && (
          <div className="flex flex-wrap gap-3">
            {podeEditar && (
              <button
                type="button"
                className={BOTAO_PRIMARIO}
                onClick={onEditar}
                aria-label={`Editar o registro de ${identificacao}`}
              >
                <Pencil size={16} aria-hidden="true" />
                Editar
              </button>
            )}
            {podeExcluir && (
              <button
                type="button"
                className={BOTAO_PERIGO}
                onClick={onExcluir}
                aria-label={`Excluir o registro de ${identificacao}`}
              >
                <Trash2 size={16} aria-hidden="true" />
                Excluir
              </button>
            )}
          </div>
        )}
        <LeituraPorTabela
          secoes={secoesDoPeiParaLeitura(registro)}
          prefixoDosIds={`pei-${registro.id}`}
          criadoEm={registro.created_at}
          atualizadoEm={registro.updated_at ?? registro.created_at}
          autor={registro.author?.full_name ?? null}
          nivelDoTitulo="h4"
        />
      </div>
    </details>
  );
}
