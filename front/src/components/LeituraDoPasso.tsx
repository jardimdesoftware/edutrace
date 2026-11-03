import { NAO_INFORMADO, type LinhaDeLeitura, type SecaoDeLeitura } from "@/utils/formularioPorTabela";

interface LeituraDoPassoProps {
  secoes: readonly SecaoDeLeitura[];
  // Um passo com várias seções as separa por um subtítulo; com uma só, o título
  // do passo já diz o que é.
  mostrarTitulos: boolean;
}

const TEXTO_LONGO = 60;

function ocupaLarguraToda(linha: LinhaDeLeitura): boolean {
  return linha.value.length > TEXTO_LONGO || linha.value.includes("\n");
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
          <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
            {secao.linhas.map((linha) => (
              <div
                key={linha.label}
                className={ocupaLarguraToda(linha) ? "sm:col-span-2 lg:col-span-3" : undefined}
              >
                <dt
                  className={
                    linha.label === secao.titulo ? "sr-only" : "text-sm font-medium text-gray-600"
                  }
                >
                  {linha.label}
                </dt>
                <dd
                  className={`mt-1 whitespace-pre-wrap break-words ${
                    linha.value === NAO_INFORMADO ? "text-gray-600 italic" : "text-gray-900"
                  }`}
                >
                  {linha.value}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  );
}
