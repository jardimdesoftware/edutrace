// Fração do limite a partir da qual o leitor de tela recebe o aviso.
const FRACAO_DO_AVISO = 0.9;

export function textoDoContador(tamanho: number, limite: number): string {
  return `${tamanho} de ${limite} caracteres`;
}

// O contador visível muda a cada tecla e fica ligado ao campo por
// aria-describedby, que o leitor de tela lê só ao entrar nele. O aviso ao vivo
// é outro: só dois textos, que mudam na entrada da faixa de 90% e no limite,
// para o leitor anunciar duas vezes por campo e não a cada tecla.
export function anuncioDoContador(tamanho: number, limite: number): string {
  if (tamanho >= limite) return `Limite de ${limite} caracteres atingido.`;
  if (tamanho >= limite * FRACAO_DO_AVISO) {
    return `Você está perto do limite de ${limite} caracteres.`;
  }
  return '';
}
