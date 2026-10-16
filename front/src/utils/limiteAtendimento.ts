// Mesma faixa do service_capacity aceito pelo PATCH /users/:email no back.
export const LIMITE_ATENDIMENTO_MAX = 200;

export type LimiteAtendimentoResult =
  | { ok: true; value: number }
  | { ok: false; error: string };

// Só dígitos ASCII: rejeita sinal, ponto, vírgula, notação científica e
// hexadecimal, que Number() converteria em um número válido.
const SOMENTE_DIGITOS = /^[0-9]+$/;

export function validarLimiteAtendimento(entrada: string): LimiteAtendimentoResult {
  const texto = entrada.trim();

  if (!texto) {
    return { ok: false, error: "Informe o limite de atendimento." };
  }

  const valor = SOMENTE_DIGITOS.test(texto) ? Number(texto) : NaN;

  if (!(valor <= LIMITE_ATENDIMENTO_MAX)) {
    return {
      ok: false,
      error: `Informe um número inteiro de 0 a ${LIMITE_ATENDIMENTO_MAX}.`,
    };
  }

  return { ok: true, value: valor };
}
