// Itens por página da tabela de usuários e de estudantes.
export const TAMANHO_DA_PAGINA = 10;

export interface Paginacao<T> {
  itens: T[];
  pagina: number;
  totalDePaginas: number;
  total: number;
  primeiro: number;
  ultimo: number;
  temAnterior: boolean;
  temProxima: boolean;
}

// Recorta a página pedida. A página é ajustada ao que existe: depois de uma
// busca, um filtro ou uma exclusão que encolhem a lista, quem estava numa página
// que deixou de existir cai na última, em vez de ver a tabela vazia.
export function paginar<T>(
  lista: readonly T[],
  pagina: number,
  tamanho: number = TAMANHO_DA_PAGINA,
): Paginacao<T> {
  const total = lista.length;
  const totalDePaginas = Math.max(1, Math.ceil(total / tamanho));
  const atual = Math.min(Math.max(1, Math.trunc(pagina) || 1), totalDePaginas);
  const inicio = (atual - 1) * tamanho;
  const itens = lista.slice(inicio, inicio + tamanho);

  return {
    itens,
    pagina: atual,
    totalDePaginas,
    total,
    primeiro: total === 0 ? 0 : inicio + 1,
    ultimo: inicio + itens.length,
    temAnterior: atual > 1,
    temProxima: atual < totalDePaginas,
  };
}

// "Exibindo 10 de 23 usuários": quantos estão na tela, do total da lista já
// filtrada.
export function textoDoIntervalo(
  paginacao: Pick<Paginacao<unknown>, "itens" | "total">,
  singular: string,
  plural: string,
): string {
  const { itens, total } = paginacao;
  const unidade = total === 1 ? singular : plural;

  return `Exibindo ${itens.length} de ${total} ${unidade}`;
}
