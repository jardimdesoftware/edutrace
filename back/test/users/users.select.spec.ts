import { PUBLIC_USER_SELECT } from 'src/users/users.select';

describe('PUBLIC_USER_SELECT', () => {
  it.each([
    'password',
    'password_reset_token',
    'password_reset_expires',
    'password_reset_attempts',
    'activation_token',
    'activation_expires',
    'must_change_password',
    'failed_login_attempts',
    'locked_until',
    'login_lock_count',
    'comments',
  ])('should not select %s', (field) => {
    expect(PUBLIC_USER_SELECT).not.toHaveProperty(field);
  });

  it('should select the id used to revoke the sessions after an update', () => {
    expect(PUBLIC_USER_SELECT).toHaveProperty('id', true);
  });

  it('should not select the Google account identifier', () => {
    expect(PUBLIC_USER_SELECT).not.toHaveProperty('google_sub');
  });

  it.each(['enrollment_number', 'course'])('should select %s', (field) => {
    expect(PUBLIC_USER_SELECT).toHaveProperty(field, true);
  });

  it.each([
    'service_status',
    'queued_at',
    'service_started_at',
    'service_closed_at',
    'service_capacity',
  ])('should select %s', (field) => {
    expect(PUBLIC_USER_SELECT).toHaveProperty(field, true);
  });

  // A relação com `true` ou `include` devolveria o registro inteiro do NAPNE,
  // com o hash da senha e os campos de recuperação.
  it('should select only the id and the name of the NAPNE responsible', () => {
    expect(PUBLIC_USER_SELECT.napne_responsible).toEqual({
      select: { id: true, full_name: true },
    });
  });

  it('should not select the raw foreign key of the responsible', () => {
    expect(PUBLIC_USER_SELECT).not.toHaveProperty('napne_responsible_id');
  });

  it('should not select the students of a NAPNE', () => {
    expect(PUBLIC_USER_SELECT).not.toHaveProperty('napne_students');
  });
});
