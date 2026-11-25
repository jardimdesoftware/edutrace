import { AuditLogsController } from 'src/audit-logs/audit-logs.controller';
import { ALLOW_LEVELS_KEY } from 'src/auth/decorators/allow-levels.decorator';
import { LEVELS } from 'src/constants';

const levelsOf = (handler: keyof AuditLogsController): number[] =>
  Reflect.getMetadata(ALLOW_LEVELS_KEY, AuditLogsController.prototype[handler]);

describe('AuditLogsController', () => {
  it('opens the log only to the administrator', () => {
    expect(levelsOf('list')).toEqual([LEVELS.ADMIN]);
    expect(levelsOf('export')).toEqual([LEVELS.ADMIN]);
  });

  it('lets every level register the PDF it downloaded', () => {
    expect([...levelsOf('registerDownload')].sort()).toEqual(
      Object.values(LEVELS).sort(),
    );
  });
});
