import type { CaseStudy } from "@/interfaces/CaseStudy";
import { formatarData } from "@/utils/formatDate";
import { NAO_INFORMADO, secoesParaLeitura, type SecaoDeLeitura } from "@/utils/estudoDeCaso";

interface LeituraProps {
  estudo: CaseStudy;
  // undefined é o curso que a tela não conhece; null é o cadastro sem curso.
  curso?: string | null;
}

function SecaoDoEstudo({ secao, indice }: { secao: SecaoDeLeitura; indice: number }) {
  const tituloId = `estudo-de-caso-secao-${indice}`;

  return (
    <section
      aria-labelledby={tituloId}
      className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-6"
    >
      <h2 id={tituloId} className="text-lg font-semibold text-emerald-800">
        {secao.titulo}
      </h2>
      <dl className="mt-4 space-y-4">
        {secao.linhas.map((linha) => (
          <div key={linha.label}>
            <dt
              className={
                linha.label === secao.titulo
                  ? "sr-only"
                  : "text-sm font-medium text-gray-600"
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
  );
}

export default function EstudoDeCasoLeitura({ estudo, curso }: LeituraProps) {
  const secoes = secoesParaLeitura(estudo, curso);

  return (
    <div className="space-y-6">
      <p className="text-sm text-gray-600">
        Criado em {formatarData(estudo.created_at)}
        {estudo.updated_at !== estudo.created_at &&
          `, atualizado em ${formatarData(estudo.updated_at)}`}
        {estudo.author && `, por ${estudo.author.full_name}`}.
      </p>
      {secoes.map((secao, indice) => (
        <SecaoDoEstudo key={secao.titulo} secao={secao} indice={indice} />
      ))}
    </div>
  );
}
