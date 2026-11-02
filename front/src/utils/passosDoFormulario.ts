// Lógica dos formulários em passos: quais passos a tabela de seções forma, onde
// cai cada erro e quando o formulário pode ser concluído. Fica fora do
// componente para ser testada sem renderizar nada.
import {
  camposDaTabela,
  type CampoDef,
  type ErrosDoFormulario,
  type SecaoDef,
} from './formularioPorTabela';

export interface PassoDef {
  rotulo: string;
  secoes: readonly SecaoDef[];
}

export interface SituacaoDosPassos {
  // Um item por passo: o passo tem algum campo com erro.
  comPendencia: boolean[];
  primeiroComPendencia: number | null;
  pendencias: number;
  podeConcluir: boolean;
}

// Um passo cabe na altura de uma tela de computador, sem rolagem, até este
// peso: campos curtos ficam três por linha, e o texto longo ocupa a linha
// toda, com cerca de cinco campos curtos de altura.
export const PESO_MAXIMO_DO_PASSO = 25;
const PESO_DO_TEXTO_LONGO = 5;

function passosDaSecao(secao: SecaoDef): PassoDef[] {
  if (secao.dividirPorGrupo) {
    return secao.grupos.map((grupo) => ({
      rotulo: grupo.titulo ?? secao.titulo,
      secoes: [{ ...secao, grupos: [grupo] }],
    }));
  }
  return [{ rotulo: secao.passo ?? secao.titulo, secoes: [secao] }];
}

// Seções seguidas com o mesmo `passo` formam um passo só; sem `passo`, cada
// seção é um passo com o título dela.
export function passosDe(secoes: readonly SecaoDef[]): PassoDef[] {
  const passos: PassoDef[] = [];
  let rotuloAberto: string | undefined;

  for (const secao of secoes) {
    const ultimo = passos[passos.length - 1];
    if (secao.passo && !secao.dividirPorGrupo && secao.passo === rotuloAberto && ultimo) {
      passos[passos.length - 1] = { ...ultimo, secoes: [...ultimo.secoes, secao] };
      continue;
    }
    passos.push(...passosDaSecao(secao));
    rotuloAberto = secao.dividirPorGrupo ? undefined : secao.passo;
  }
  return passos;
}

function caminhosDoPasso(passo: PassoDef): string[] {
  return [
    ...camposDaTabela(passo.secoes).map((campo) => campo.caminho),
    ...passo.secoes.flatMap((secao) => secao.caminhosExtras ?? []),
  ];
}

const dentroDe = (caminho: string, base: string): boolean =>
  caminho === base || caminho.startsWith(`${base}.`);

// -1 quando nenhum passo tem o caminho. Um item de lista ("a.0.b") pertence ao
// passo do campo da lista ("a").
export function passoDoCaminho(passos: readonly PassoDef[], caminho: string): number {
  return passos.findIndex((passo) =>
    caminhosDoPasso(passo).some((base) => dentroDe(caminho, base)),
  );
}

// Erro de um caminho que nenhum passo conhece vai para o primeiro passo, para
// o formulário nunca ficar bloqueado por um erro que o usuário não encontra.
export function situacaoDosPassos(
  passos: readonly PassoDef[],
  erros: ErrosDoFormulario,
): SituacaoDosPassos {
  const caminhos = Object.keys(erros);
  const indices = new Set(caminhos.map((caminho) => Math.max(0, passoDoCaminho(passos, caminho))));
  const comPendencia = passos.map((_, indice) => indices.has(indice));
  const primeiro = comPendencia.indexOf(true);

  return {
    comPendencia,
    primeiroComPendencia: primeiro === -1 ? null : primeiro,
    pendencias: caminhos.length,
    podeConcluir: caminhos.length === 0,
  };
}

// O caminho com erro do primeiro passo que tem erro, para o foco ir para ele.
export function primeiroCaminhoComErro(
  passos: readonly PassoDef[],
  erros: ErrosDoFormulario,
): string | null {
  const candidatos = Object.keys(erros).map((caminho) => ({
    caminho,
    passo: Math.max(0, passoDoCaminho(passos, caminho)),
  }));
  if (candidatos.length === 0) return null;
  return candidatos.reduce((menor, atual) => (atual.passo < menor.passo ? atual : menor)).caminho;
}

export function textoDoBloqueio(passos: readonly PassoDef[], erros: ErrosDoFormulario): string {
  const { comPendencia, pendencias } = situacaoDosPassos(passos, erros);
  if (pendencias === 0) return '';

  const rotulos = passos.filter((_, indice) => comPendencia[indice]).map((passo) => passo.rotulo);
  const onde = rotulos.length ? ` em: ${rotulos.join(', ')}` : '';
  return `Para concluir, resolva ${pendencias} ${pendencias === 1 ? 'pendência' : 'pendências'}${onde}.`;
}

export function limitarPasso(indice: number, total: number): number {
  return Math.min(Math.max(indice, 0), Math.max(total - 1, 0));
}

// O formulário muda quando o JSON dos valores muda: a mesma comparação que o
// aviso de descartar sempre usou.
export function houveAlteracao(inicial: unknown, atual: unknown): boolean {
  return JSON.stringify(inicial) !== JSON.stringify(atual);
}

const pesoDoCampo = (campo: CampoDef): number =>
  campo.tipo === 'textoLongo' ? PESO_DO_TEXTO_LONGO : 1;

export function pesoDoPasso(passo: PassoDef): number {
  return camposDaTabela(passo.secoes).reduce((soma, campo) => soma + pesoDoCampo(campo), 0);
}
