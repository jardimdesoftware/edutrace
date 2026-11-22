import { Reflector } from '@nestjs/core';
import { ALLOW_LEVELS_KEY } from 'src/auth/decorators/allow-levels.decorator';
import { AeeAppointmentsController } from 'src/aee-appointments/aee-appointments.controller';
import { LEVELS } from 'src/constants';

describe('AeeAppointmentsController', () => {
  const routes = ['list', 'students', 'create', 'update', 'remove'] as const;

  it.each(routes)(
    '%s allows only the AEE teacher level, not even the administrator',
    (route) => {
      const levels = new Reflector().get<number[]>(
        ALLOW_LEVELS_KEY,
        AeeAppointmentsController.prototype[route],
      );

      expect(levels).toEqual([LEVELS.PROFESSOR_AEE]);
    },
  );

  it('covers every route of the controller', () => {
    const declared = Object.getOwnPropertyNames(
      AeeAppointmentsController.prototype,
    ).filter((name) => name !== 'constructor');

    expect(declared.sort()).toEqual([...routes].sort());
  });
});
