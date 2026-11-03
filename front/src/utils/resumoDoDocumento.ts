// Frase sob o título de um documento do estudante já criado: quando foi criado,
// quando foi alterado (só se foi) e por quem. O formatador de data entra como
// parâmetro para a função ficar pura e testável.
export function resumoDoDocumento(
  criadoEm: string,
  atualizadoEm: string,
  autor: string | null,
  formatar: (data: string) => string,
): string {
  const alterado = atualizadoEm !== criadoEm ? `, atualizado em ${formatar(atualizadoEm)}` : '';
  const por = autor ? `, por ${autor}` : '';
  return `Criado em ${formatar(criadoEm)}${alterado}${por}.`;
}
