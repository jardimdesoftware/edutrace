// Opções do alerta de erro do SweetAlert2. A mensagem vai em text, nunca no
// segundo argumento posicional do Swal.fire, que o SweetAlert2 trata como HTML.
export function errorAlertOptions(
  title: string,
  error: unknown,
  fallback: string,
): { title: string; text: string; icon: "error" } {
  return {
    title,
    text: error instanceof Error ? error.message : fallback,
    icon: "error",
  };
}
