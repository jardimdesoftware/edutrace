/**
 * Geração de matrícula para os testes de carga.
 *
 * O cadastro de estudante (POST /users com roles [2]) exige matrícula e curso.
 * A matrícula é única no banco e a API só aceita letras maiúsculas sem acento,
 * dígitos, ponto, hífen e barra, com no máximo 30 caracteres; duas iterações
 * com a mesma matrícula recebem 409 no lugar do 201 esperado. Este helper usa
 * só [A-Z0-9] e combina o instante, a VU, a iteração e um trecho aleatório,
 * para que VUs em paralelo e execuções seguidas não repitam o valor.
 */

const ENROLLMENT_NUMBER_MAX_LENGTH = 30;
const RANDOM_LENGTH = 6;

function randomBlock(length) {
  let block = '';

  for (let index = 0; index < length; index++) {
    block += Math.floor(Math.random() * 36).toString(36).toUpperCase();
  }

  return block;
}

export function randomEnrollmentNumber() {
  const timestamp = Date.now().toString(36).toUpperCase();

  // __VU e __ITER só existem dentro do k6; fora dele (um script de apoio) a
  // matrícula sai com zero no lugar deles.
  const vu = typeof __VU === 'undefined' ? 0 : __VU;
  const iteration = typeof __ITER === 'undefined' ? 0 : __ITER;

  const enrollmentNumber = `K6${timestamp}V${vu}I${iteration}${randomBlock(RANDOM_LENGTH)}`;

  // O corte em 30 só atua com milhares de VUs ou milhões de iterações; na faixa
  // normal a matrícula tem cerca de 20 caracteres.
  return enrollmentNumber.slice(0, ENROLLMENT_NUMBER_MAX_LENGTH);
}
