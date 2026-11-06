import type { SecaoDeLeitura } from "@/utils/formularioPorTabela";
import LinhasDeLeitura from "./LinhasDeLeitura";

interface LeituraDoPassoProps {
  secoes: readonly SecaoDeLeitura[];
  // Um passo com várias seções as separa por um subtítulo; com uma só, o título
  // do passo já diz o que é.
  mostrarTitulos: boolean;
}

// Um passo do documento em modo leitura: o mesmo que o formulário mostra, com
// o valor de cada campo em texto, sem controles desabilitados.
export default function LeituraDoPasso({ secoes, mostrarTitulos }: LeituraDoPassoProps) {
  return (
    <div className="space-y-6">
      {secoes.map((secao) => (
        <section key={secao.titulo} className="space-y-3">
          {mostrarTitulos && (
            <h3 className="text-base font-semibold text-gray-900">{secao.titulo}</h3>
          )}
          <LinhasDeLeitura linhas={secao.linhas} />
        </section>
      ))}
    </div>
  );
}
