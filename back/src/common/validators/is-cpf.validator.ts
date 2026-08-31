import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';

const CPF_LENGTH = 11;

export function onlyDigits(value: string): string {
  return (value ?? '').replace(/\D/g, '');
}

export function isValidCpf(value: string): boolean {
  const digits = onlyDigits(value);

  if (digits.length !== CPF_LENGTH) {
    return false;
  }

  // Sequências repetidas passam no cálculo do módulo 11 e precisam ser barradas
  // à parte. 00000000000 é o caso que mais aparece em cadastro de teste.
  if (/^(\d)\1{10}$/.test(digits)) {
    return false;
  }

  const checkDigit = (length: number): number => {
    let sum = 0;

    for (let index = 0; index < length; index++) {
      sum += Number(digits[index]) * (length + 1 - index);
    }

    const rest = (sum * 10) % CPF_LENGTH;

    return rest === 10 ? 0 : rest;
  };

  return (
    checkDigit(9) === Number(digits[9]) && checkDigit(10) === Number(digits[10])
  );
}

export function IsCpf(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isCpf',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown): boolean {
          return typeof value === 'string' && isValidCpf(value);
        },
        defaultMessage(args: ValidationArguments): string {
          return `O campo ${args.property} deve ser um CPF válido.`;
        },
      },
    });
  };
}
