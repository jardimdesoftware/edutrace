import { formatarData } from "@/utils/formatDate";
import { NAO_INFORMADO, type SecaoDeLeitura } from "@/utils/formularioPorTabela";

interface LeituraPorTabelaProps {
  secoes: SecaoDeLeitura[];
  // Prefixo dos ids dos títulos: vários documentos na mesma página não podem
  // repetir o id que liga cada seção ao seu título.
  prefixoDosIds: string;
  criadoEm: string;
  atualizadoEm: string;
  autor: string | null;
  // Nível do título das seções: um documento sob o título de outro, como o PAEE
  // de um período, desce um nível.
  nivelDoTitulo?: "h2" | "h3";
}

function SecaoDoDocumento({
  secao,
  tituloId,
  Titulo,
}: {
  secao: SecaoDeLeitura;
  tituloId: string;
  Titulo: "h2" | "h3";
}) {
  return (
    <section
      aria-labelledby={tituloId}
      className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-6"
    >
      <Titulo id={tituloId} className="text-lg font-semibold text-emerald-800">
        {secao.titulo}
      </Titulo>
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

// Documento do estudante em modo leitura: quando foi criado e alterado, o autor
// e as seções já montadas pela tabela do documento.
export default function LeituraPorTabela({
  secoes,
  prefixoDosIds,
  criadoEm,
  atualizadoEm,
  autor,
  nivelDoTitulo = "h2",
}: LeituraPorTabelaProps) {
  return (
    <div className="space-y-6">
      <p className="text-sm text-gray-600">
        Criado em {formatarData(criadoEm)}
        {atualizadoEm !== criadoEm && `, atualizado em ${formatarData(atualizadoEm)}`}
        {autor && `, por ${autor}`}.
      </p>
      {secoes.map((secao, indice) => (
        <SecaoDoDocumento
          key={secao.titulo}
          secao={secao}
          tituloId={`${prefixoDosIds}-secao-${indice}`}
          Titulo={nivelDoTitulo}
        />
      ))}
    </div>
  );
}
