import { ValidationPipe } from '@nestjs/common';

// transform: true faz o controller receber a instância do DTO, e não o corpo
// cru. Sem isso o @Transform do CPF normalizaria apenas o objeto usado na
// validação, e o valor com máscara chegaria ao banco assim mesmo.
//
// whitelist: true restringe o corpo às propriedades com decorator de
// validação, e o service o repassa inteiro ao Prisma: sem isso qualquer coluna
// do model enviada no corpo, como id ou created_at, seria gravada.
// forbidNonWhitelisted: true responde 400 com o nome de cada campo fora do DTO,
// em vez de descartá-lo em silêncio, para que a tentativa de gravar um campo
// indevido ou um erro de contrato não passe como alteração aceita. As telas de
// edição do front enviam só os campos editáveis (utils/editPayload.ts).
export function createValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  });
}
