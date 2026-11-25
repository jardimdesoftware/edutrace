import {
  diffRecords,
  PROTECTED_VALUE,
  protectValue,
} from 'src/audit-logs/audit-changes';

describe('audit-changes', () => {
  it('returns only the fields that changed, with before and after', () => {
    const changes = diffRecords(
      'User',
      { full_name: 'Ana', email: 'a@x.com' },
      { full_name: 'Ana Maria', email: 'a@x.com' },
    );

    expect(changes).toEqual({ full_name: { from: 'Ana', to: 'Ana Maria' } });
  });

  it('returns null when nothing but updated_at changed', () => {
    const changes = diffRecords(
      'User',
      { full_name: 'Ana', updated_at: new Date('2026-01-01') },
      { full_name: 'Ana', updated_at: new Date('2026-02-01') },
    );

    expect(changes).toBeNull();
  });

  it('never stores the value of passwords and tokens', () => {
    const changes = diffRecords(
      'User',
      { password: 'hash-antigo', activation_token: null },
      { password: 'hash-novo', activation_token: 'token' },
    );

    expect(changes).toEqual({
      password: { from: PROTECTED_VALUE, to: PROTECTED_VALUE },
      activation_token: { from: null, to: PROTECTED_VALUE },
    });
  });

  it('masks the CPF', () => {
    expect(protectValue('User', 'cpf', '123.456.789-01')).toBe(
      '***.456.789-**',
    );
  });

  it('hides the content of student forms but keeps their metadata', () => {
    expect(protectValue('Anamnesis', 'family_data', { mae: 'x' })).toBe(
      PROTECTED_VALUE,
    );
    expect(protectValue('Comments', 'comment', 'texto')).toBe(PROTECTED_VALUE);
    expect(protectValue('Comments', 'id_user', 3)).toBe(3);
    expect(protectValue('AeePlan', 'semester', '2026.1')).toBe('2026.1');
  });

  it('writes dates as ISO 8601 in UTC', () => {
    expect(
      protectValue('User', 'deleted_at', new Date('2026-03-01T12:00:00Z')),
    ).toBe('2026-03-01T12:00:00.000Z');
  });
});
