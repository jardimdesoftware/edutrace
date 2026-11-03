import { Pencil, Trash2 } from "lucide-react";
import type { AeePlan } from "@/interfaces/AeePlan";
import { secoesDoPlanoParaLeitura } from "@/utils/paee";
import LeituraPorTabela from "./LeituraPorTabela";
import { BOTAO_PERIGO, BOTAO_PRIMARIO } from "./form/botoes";

interface PaeeDoPeriodoProps {
  plano: AeePlan;
  aberto: boolean;
  podeEditar: boolean;
  onEditar: () => void;
  onExcluir: () => void;
}

// O PAEE de um período letivo, recolhível: o estudante acumula um por período, e
// só o mais recente abre de início.
export default function PaeeDoPeriodo({
  plano,
  aberto,
  podeEditar,
  onEditar,
  onExcluir,
}: PaeeDoPeriodoProps) {
  return (
    <details open={aberto} className="rounded-2xl border border-gray-200 bg-gray-50 p-4 sm:p-5">
      <summary className="cursor-pointer text-lg font-semibold text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600">
        <h2 className="inline">Período letivo {plano.semester}</h2>
      </summary>
      <div className="mt-4 space-y-4">
        {podeEditar && (
          <div className="flex flex-wrap gap-3">
            <button type="button" className={BOTAO_PRIMARIO} onClick={onEditar}>
              <Pencil size={16} aria-hidden="true" />
              Editar
            </button>
            <button type="button" className={BOTAO_PERIGO} onClick={onExcluir}>
              <Trash2 size={16} aria-hidden="true" />
              Excluir
            </button>
          </div>
        )}
        <LeituraPorTabela
          secoes={secoesDoPlanoParaLeitura(plano, plano.student.course)}
          prefixoDosIds={`paee-${plano.id}`}
          criadoEm={plano.created_at}
          atualizadoEm={plano.updated_at}
          autor={plano.author?.full_name ?? null}
          nivelDoTitulo="h3"
        />
      </div>
    </details>
  );
}
