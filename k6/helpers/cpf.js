/**
 * Geração de CPF estruturalmente válido para os testes de carga.
 *
 * A API valida os dígitos verificadores no cadastro de usuário, então um número
 * aleatório de 11 dígitos é recusado com 400 e o teste não chega a exercitar o
 * endpoint.
 */

function checkDigit(digits, length) {
  let sum = 0;

  for (let index = 0; index < length; index++) {
    sum += Number(digits[index]) * (length + 1 - index);
  }

  const rest = (sum * 10) % 11;

  return rest === 10 ? 0 : rest;
}

export function randomCpf() {
  let base = '';

  for (let index = 0; index < 9; index++) {
    base += Math.floor(Math.random() * 10);
  }

  // Sequências repetidas passam no cálculo do módulo 11 e são recusadas pela
  // API, então o primeiro dígito é trocado quando o sorteio cai numa delas.
  if (/^(\d)\1{8}$/.test(base)) {
    base = String((Number(base[0]) + 1) % 10) + base.slice(1);
  }

  const withFirst = base + checkDigit(base, 9);

  return withFirst + checkDigit(withFirst, 10);
}
