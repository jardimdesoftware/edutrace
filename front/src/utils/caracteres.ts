// Os caracteres de controle (categoria Cc) e o surrogate solto (Cs) são
// recusados nos textos longos, menos a tabulação e as quebras de linha: é o
// TEXT_PATTERN do back (back/src/common/dto-fields.ts), escrito como a busca do
// caractere proibido em vez do texto inteiro casando com o padrão.
export const CONTROLE_EM_TEXTO = /(?![\t\n\r])[\p{Cc}\p{Cs}]/u;
