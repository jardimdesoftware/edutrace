import { requireIntegrationDatabaseUrl } from './integration-database';

// Os specs de integração gravam e apagam dados no banco do
// INTEGRATION_DATABASE_URL (cada um apaga as contas do próprio domínio de
// e-mail). O banco precisa ser descartável, e esta guarda é a única coisa
// entre um INTEGRATION_DATABASE_URL apontado para o banco errado e a gravação
// e a exclusão de dados nele.
describe('requireIntegrationDatabaseUrl', () => {
  it.each([
    'postgresql://test:test@localhost:5432/edutrace_it',
    'postgres://test:test@localhost:5433/edutrace_it',
    'postgresql://test:test@localhost:5432/edutrace_it?sslmode=disable',
    'postgresql://test:test@db.interno:5432/outro_projeto_it',
  ])('should accept %s and return it unchanged', (url) => {
    expect(requireIntegrationDatabaseUrl(url)).toBe(url);
  });

  it.each([
    ['testdb', 'postgresql://test:test@localhost:5432/testdb'],
    ['edutrace', 'postgresql://test:test@localhost:5432/edutrace'],
    [
      'edutrace_it_backup',
      'postgresql://test:test@localhost:5432/edutrace_it_backup',
    ],
    ['it', 'postgresql://test:test@localhost:5432/it'],
    ['EDUTRACE_IT', 'postgresql://test:test@localhost:5432/EDUTRACE_IT'],
    [
      'edutrace_it/outro',
      'postgresql://test:test@localhost:5432/edutrace_it/outro',
    ],
    [
      'testdb',
      'postgresql://test:test@localhost:5432/testdb?database=edutrace_it',
    ],
  ])('should refuse the database "%s" in %s', (name, url) => {
    expect(() => requireIntegrationDatabaseUrl(url)).toThrow(
      `INTEGRATION_DATABASE_URL aponta para o banco "${name}"`,
    );
  });

  it('should tell why the database is refused', () => {
    expect(() =>
      requireIntegrationDatabaseUrl(
        'postgresql://test:test@localhost:5432/testdb',
      ),
    ).toThrow(
      'O nome do banco precisa terminar em "_it", porque os specs de integração gravam e apagam dados nele.',
    );
  });

  it('should refuse a URL with no database name', () => {
    expect(() =>
      requireIntegrationDatabaseUrl('postgresql://test:test@localhost:5432'),
    ).toThrow('INTEGRATION_DATABASE_URL aponta para o banco ""');
  });

  it.each([undefined, '', '   '])(
    'should refuse the missing value %j',
    (value) => {
      expect(() => requireIntegrationDatabaseUrl(value)).toThrow(
        'INTEGRATION_DATABASE_URL não está definida.',
      );
    },
  );

  it.each(['not a url', 'mysql://root:root@localhost:3306/edutrace_it'])(
    'should refuse %j, which is not a PostgreSQL URL',
    (value) => {
      expect(() => requireIntegrationDatabaseUrl(value)).toThrow(
        'INTEGRATION_DATABASE_URL não é uma URL postgres:// ou postgresql://.',
      );
    },
  );

  it('should not leak the password in the error message', () => {
    const urls = [
      'postgresql://usuario:senha-secreta@localhost:5432/testdb',
      'mysql://usuario:senha-secreta@localhost:3306/edutrace_it',
      'senha-secreta not a url',
    ];

    for (const url of urls) {
      let message = '';
      try {
        requireIntegrationDatabaseUrl(url);
      } catch (error) {
        message = (error as Error).message;
      }

      expect(message).not.toBe('');
      expect(message).not.toContain('senha-secreta');
    }
  });
});
