import { Check } from "lucide-react";
import { NAO_INFORMADO, type LinhaDeLeitura } from "@/utils/formularioPorTabela";

const TEXTO_LONGO = 60;
const LARGURA_TODA = "sm:col-span-2 lg:col-span-3";
const GRADE = "grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3";

function ocupaLarguraToda(linha: LinhaDeLeitura): boolean {
  return !!linha.larga || linha.value.length > TEXTO_LONGO || linha.value.includes("\n");
}

// Linhas seguidas do mesmo grupo formam um bloco com a legenda do grupo, como no
// formulário; as seguidas sem grupo formam um bloco sem legenda.
function blocosDe(linhas: readonly LinhaDeLeitura[]): LinhaDeLeitura[][] {
  return linhas.reduce<LinhaDeLeitura[][]>((blocos, linha) => {
    const ultimo = blocos[blocos.length - 1];
    if (ultimo && ultimo[0].grupo === linha.grupo) {
      return [...blocos.slice(0, -1), [...ultimo, linha]];
    }
    return [...blocos, [linha]];
  }, []);
}

function Opcoes({ opcoes }: { opcoes: NonNullable<LinhaDeLeitura["opcoes"]> }) {
  return (
    <ul className={`${LARGURA_TODA} grid gap-2 sm:grid-cols-2 lg:grid-cols-3`}>
      {opcoes.map((opcao) => (
        <li
          key={opcao.rotulo}
          className={`flex items-start gap-2 ${opcao.marcado ? "text-gray-900" : "text-gray-600"}`}
        >
          <span
            aria-hidden="true"
            className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
              opcao.marcado ? "border-emerald-700 bg-emerald-700 text-white" : "border-gray-400 bg-white"
            }`}
          >
            {opcao.marcado && <Check size={12} strokeWidth={3} />}
          </span>
          <span className="sr-only">{opcao.marcado ? "Marcado: " : "Não marcado: "}</span>
          {opcao.rotulo}
        </li>
      ))}
    </ul>
  );
}

function Campo({ linha }: { linha: LinhaDeLeitura }) {
  return (
    <div className={ocupaLarguraToda(linha) ? LARGURA_TODA : undefined}>
      <dt className="text-sm font-medium text-gray-600">{linha.rotulo ?? linha.label}</dt>
      <dd
        className={`mt-1 whitespace-pre-wrap break-words ${
          linha.value === NAO_INFORMADO ? "text-gray-600 italic" : "text-gray-900"
        }`}
      >
        {linha.value}
      </dd>
    </div>
  );
}

function Bloco({ linhas }: { linhas: LinhaDeLeitura[] }) {
  const campos = linhas.filter((linha) => !linha.opcoes);
  const opcoes = linhas.find((linha) => linha.opcoes)?.opcoes;
  const conteudo = (
    <div className={GRADE}>
      {opcoes && <Opcoes opcoes={opcoes} />}
      {campos.length > 0 && (
        <dl className={`${LARGURA_TODA} grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3`}>
          {campos.map((linha) => (
            <Campo key={linha.label} linha={linha} />
          ))}
        </dl>
      )}
    </div>
  );

  const grupo = linhas[0].grupo;
  if (grupo === undefined) return conteudo;

  return (
    <fieldset className="min-w-0 rounded-xl border border-gray-200 p-4">
      <legend className="px-1 text-sm font-semibold text-gray-900">{grupo}</legend>
      {conteudo}
    </fieldset>
  );
}

// Linhas de leitura no desenho do formulário: cada campo com o nome que tem nele,
// os grupos com a legenda e as listas de verificação com todos os itens.
export default function LinhasDeLeitura({ linhas }: { linhas: readonly LinhaDeLeitura[] }) {
  return (
    <div className="space-y-4">
      {blocosDe(linhas).map((bloco) => (
        <Bloco key={bloco[0].label} linhas={bloco} />
      ))}
    </div>
  );
}
