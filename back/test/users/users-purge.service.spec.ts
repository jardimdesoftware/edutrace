import 'reflect-metadata';
import { CronExpression } from '@nestjs/schedule';
import { UsersPurgeService } from 'src/users/users-purge.service';
import { UsersService } from 'src/users/users.service';

describe('UsersPurgeService', () => {
  let service: UsersPurgeService;
  let usersService: { purgeExpired: jest.Mock };

  beforeEach(() => {
    usersService = { purgeExpired: jest.fn().mockResolvedValue(0) };
    service = new UsersPurgeService(usersService as unknown as UsersService);
  });

  it('should run once a day at 3 a.m.', () => {
    const cron = Reflect.getMetadata(
      'SCHEDULE_CRON_OPTIONS',
      UsersPurgeService.prototype.purgeExpiredUsers,
    );

    expect(cron.cronTime).toBe(CronExpression.EVERY_DAY_AT_3AM);
  });

  it('should answer how many users were deleted', async () => {
    usersService.purgeExpired.mockResolvedValue(3);

    await expect(service.purgeExpiredUsers()).resolves.toBe(3);

    expect(usersService.purgeExpired).toHaveBeenCalledTimes(1);
  });

  it('should log the failure and not throw, so the next run still happens', async () => {
    usersService.purgeExpired.mockRejectedValue(new Error('banco fora do ar'));
    const error = jest
      .spyOn(service['logger'], 'error')
      .mockImplementation(() => undefined);

    await expect(service.purgeExpiredUsers()).resolves.toBe(0);

    expect(error).toHaveBeenCalledTimes(1);
  });
});
