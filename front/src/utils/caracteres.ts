// Os caracteres de controle (categoria Cc) e o surrogate solto (Cs) são
// recusados nos textos longos, menos a tabulação e as quebras de linha: é o
// TEXT_PATTERN do back (back/src/common/dto-fields.ts), escrito como a busca do
// caractere proibido em vez do texto inteiro casando com o padrão.
export const CONTROLE_EM_TEXTO = /(?![\t\n\r])[\p{Cc}\p{Cs}]/u;

// Mais de 30 marcas combinantes (categoria M) seguidas: o limite do Stream-Safe
// Text Format (UAX #15), o mesmo que o back aplica ao comment e à busca. Acima
// disso o back recusa o texto, porque normalizar uma sequência longa de marcas
// custa tempo quadrático.
export const MARCAS_DEMAIS = /\p{M}{31,}/u;

const CONTROLES_EM_TEXTO = new RegExp(CONTROLE_EM_TEXTO.source, 'gu');

export function removerControlesDeTexto(texto: string): string {
  return texto.replace(CONTROLES_EM_TEXTO, '');
}
