export interface Retangulo {
  top: number;
  bottom: number;
  left: number;
}

export interface Tamanho {
  width: number;
  height: number;
}

// Espaço mínimo entre o painel e a borda da janela.
export const MARGEM_DO_PAINEL = 8;

// Posição de um painel que flutua (position: fixed) junto ao seu gatilho, sem
// ocupar espaço na tabela. Abre para baixo; se não couber embaixo e couber em
// cima, abre para cima. A borda esquerda acompanha o gatilho, mas o painel
// nunca passa da borda direita da janela.
export function posicaoDoPainel(
  gatilho: Retangulo,
  painel: Tamanho,
  janela: Tamanho,
  margem: number = MARGEM_DO_PAINEL,
): { top: number; left: number } {
  const cabeEmbaixo = gatilho.bottom + painel.height + margem <= janela.height;
  const cabeEmCima = gatilho.top - painel.height - margem >= 0;
  const top = cabeEmbaixo || !cabeEmCima ? gatilho.bottom : gatilho.top - painel.height;

  const limiteDaDireita = Math.max(margem, janela.width - painel.width - margem);
  const left = Math.max(margem, Math.min(gatilho.left, limiteDaDireita));

  return { top, left };
}
