export const ENROLLMENT_NUMBER_MAX_LENGTH = 30;
export const COURSE_MAX_LENGTH = 150;

// Letras, dígitos, ponto, hífen e barra. Validado depois de
// normalizeEnrollmentNumber, então a caixa alta é a única aceita.
export const ENROLLMENT_NUMBER_PATTERN = /^[A-Z0-9./-]+$/;

// Qualquer caractere fora da categoria Cc (quebra de linha, tabulação, NUL, DEL
// e os controles C1). O curso entra em tabela, CSV e log, onde um caractere de
// controle quebra a linha ou forja uma entrada.
export const COURSE_PATTERN = /^[^\p{Cc}]+$/u;

// A matrícula é única no banco. Normalizar na entrada, como o CPF faz com
// onlyDigits, impede que "ads-01" e "ADS-01 " virem duas matrículas.
export function normalizeEnrollmentNumber({
  value,
}: {
  value: unknown;
}): unknown {
  return typeof value === 'string' ? value.trim().toUpperCase() : value;
}

export function trimText({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim() : value;
}
