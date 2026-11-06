import { History } from "lucide-react";
import { formatarDataEHora, type VersaoResumida } from "@/utils/historicoDeEdicoes";
import { BOTAO_SECUNDARIO } from "./form/botoes";

interface AvisoDeVersaoProps {
  versao: VersaoResumida;
  onVoltar: () => void;
}

// Avisa que a tela mostra uma versão antiga, só para leitura, e leva de volta
// à versão atual.
export default function AvisoDeVersao({ versao, onVoltar }: AvisoDeVersaoProps) {
  return (
    <div
      role="status"
      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-900"
    >
      <p className="flex items-center gap-2 text-sm font-medium">
        <History size={18} aria-hidden="true" />
        Você está vendo a versão {versao.version}, salva por {versao.author_name} em{" "}
        {formatarDataEHora(versao.created_at)}. Esta versão é só para leitura.
      </p>
      <button type="button" className={BOTAO_SECUNDARIO} onClick={onVoltar}>
        Voltar à versão atual
      </button>
    </div>
  );
}
