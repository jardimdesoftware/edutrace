// Valor do atributo pattern dos campos de e-mail. O navegador compila o
// pattern com a flag v, em que o hífen dentro de uma classe de caracteres
// precisa de escape; sem ele a expressão é inválida e a validação é ignorada.
export const EMAIL_PATTERN = String.raw`[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}`;

// Endereço de e-mail não tem espaço: o campo descarta o que for digitado ou
// colado, em vez de só reprovar no envio.
export function removerEspacos(valor: string): string {
  return valor.replace(/\s/g, "");
}
