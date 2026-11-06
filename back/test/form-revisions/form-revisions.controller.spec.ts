import { ALLOW_LEVELS_KEY } from 'src/auth/decorators/allow-levels.decorator';
import { LEVELS } from 'src/constants';
import { FormRevisionsController } from 'src/form-revisions/form-revisions.controller';

describe('FormRevisionsController access levels', () => {
  it.each(['list', 'findVersion'] as const)(
    'should open %s only to the professionals that read student forms',
    (route) => {
      const levels = Reflect.getMetadata(
        ALLOW_LEVELS_KEY,
        FormRevisionsController.prototype[route],
      );

      expect(levels).toEqual([
        LEVELS.PROFISSIONAL_EDUCACAO,
        LEVELS.PROFISSIONAL_SAUDE,
        LEVELS.PROFISSIONAL_NAPNE,
        LEVELS.PROFESSOR_AEE,
      ]);
    },
  );
});
