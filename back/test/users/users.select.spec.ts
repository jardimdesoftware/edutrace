import { LEVELS } from 'src/constants';
import {
  PUBLIC_USER_SELECT,
  USER_WITH_MANAGER_CONTACT_SELECT,
  userSelectFor,
} from 'src/users/users.select';

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

  // Mesma razão do NAPNE responsável: o registro inteiro do servidor traria o
  // hash da senha. O texto livre antigo também não sai: a coluna agora é
  // pedagogical_manager_legacy, ignorada pelo client.
  it('should select only the id and the name of the pedagogical manager', () => {
    expect(PUBLIC_USER_SELECT.pedagogical_manager).toEqual({
      select: { id: true, full_name: true },
    });
  });

  it.each([
    'pedagogical_manager_id',
    'pedagogical_manager_legacy',
    'managed_students',
  ])('should not select %s', (field) => {
    expect(PUBLIC_USER_SELECT).not.toHaveProperty(field);
  });

  it('should select the name of the external manager', () => {
    expect(PUBLIC_USER_SELECT).toHaveProperty('external_manager_name', true);
  });

  // Negação por padrão: o telefone e o CPF do responsável externo, dado de
  // quem não usa o sistema, ficam fora do select público e entram só pelo
  // select de contato (ASVS 5.0, 8.2.3; OWASP Authorization Cheat Sheet).
  it.each(['external_manager_phone', 'external_manager_cpf'])(
    'should not select %s in the public select',
    (field) => {
      expect(PUBLIC_USER_SELECT).not.toHaveProperty(field);
    },
  );
});

describe('USER_WITH_MANAGER_CONTACT_SELECT', () => {
  it('should be the public select plus the phone and the cpf of the external manager, and nothing else', () => {
    expect(USER_WITH_MANAGER_CONTACT_SELECT).toEqual({
      ...PUBLIC_USER_SELECT,
      external_manager_phone: true,
      external_manager_cpf: true,
    });
  });

  it.each([
    'password',
    'password_reset_token',
    'activation_token',
    'google_sub',
  ])('should not select %s', (field) => {
    expect(USER_WITH_MANAGER_CONTACT_SELECT).not.toHaveProperty(field);
  });
});

describe('userSelectFor', () => {
  it.each([
    ['Administrador', LEVELS.ADMIN],
    ['Profissional NAPNE', LEVELS.PROFISSIONAL_NAPNE],
  ])('should give the %s the select with the contact', (_, level) => {
    expect(userSelectFor(level)).toBe(USER_WITH_MANAGER_CONTACT_SELECT);
  });

  it.each([
    ['Profissional de Educação', LEVELS.PROFISSIONAL_EDUCACAO],
    ['Profissional de Saúde', LEVELS.PROFISSIONAL_SAUDE],
    ['Estudante', LEVELS.ALUNO_ESTUDANTE],
    ['um nível desconhecido', 99],
    ['um nível ausente', undefined as unknown as number],
  ])('should give %s the public select, without the contact', (_, level) => {
    const select = userSelectFor(level);

    expect(select).toBe(PUBLIC_USER_SELECT);
    expect(select).not.toHaveProperty('external_manager_phone');
    expect(select).not.toHaveProperty('external_manager_cpf');
  });
});
