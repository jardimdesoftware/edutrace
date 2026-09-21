import { PUBLIC_USER_SELECT } from 'src/users/users.select';

describe('PUBLIC_USER_SELECT', () => {
  it.each([
    'password',
    'password_reset_token',
    'password_reset_expires',
    'password_reset_attempts',
    'must_change_password',
    'failed_login_attempts',
    'locked_until',
    'login_lock_count',
  ])('should not select %s', (field) => {
    expect(PUBLIC_USER_SELECT).not.toHaveProperty(field);
  });

  it('should select the id used to revoke the sessions after an update', () => {
    expect(PUBLIC_USER_SELECT).toHaveProperty('id', true);
  });
});
