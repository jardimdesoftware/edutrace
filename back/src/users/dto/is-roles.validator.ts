import { registerDecorator, ValidationOptions } from 'class-validator';
import { rolesCompositionError } from '../roles';

export function IsRoles(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isRoles',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown): boolean {
          return rolesCompositionError(value) === null;
        },
        defaultMessage(args): string {
          return (
            rolesCompositionError(args?.value) ??
            'O campo roles deve ser uma lista de papéis válida.'
          );
        },
      },
    });
  };
}
