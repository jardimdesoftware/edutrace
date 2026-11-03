const POSTGRES_PROTOCOLS = ['postgres:', 'postgresql:'];

// Nome sem barra e com algo antes do sufixo: "it" sozinho não vale.
const INTEGRATION_DATABASE_NAME = /^[^/]+_it$/;

function parsePostgresUrl(url: string): URL | null {
  try {
    const parsed = new URL(url);

    return POSTGRES_PROTOCOLS.includes(parsed.protocol) ? parsed : null;
  } catch {
    return null;
  }
}

// O nome vem do caminho da URL, como o pg-connection-string faz: um
// ?database=... na query não o substitui.
function databaseNameOf(url: URL): string {
  const path = url.pathname.slice(1);

  try {
    return decodeURI(path);
  } catch {
    return path;
  }
}

// O spec de integração apaga a tabela User inteira. Recusa qualquer banco cujo
// nome não termine em "_it", para que um INTEGRATION_DATABASE_URL apontado por
// engano para o testdb, o banco de desenvolvimento ou o de produção não perca
// os dados. As mensagens citam só o nome do banco: a URL carrega a senha.
export function requireIntegrationDatabaseUrl(url: string | undefined): string {
  if (!url || !url.trim()) {
    throw new Error('INTEGRATION_DATABASE_URL não está definida.');
  }

  const parsed = parsePostgresUrl(url);
  if (!parsed) {
    throw new Error(
      'INTEGRATION_DATABASE_URL não é uma URL postgres:// ou postgresql://.',
    );
  }

  const name = databaseNameOf(parsed);
  if (!INTEGRATION_DATABASE_NAME.test(name)) {
    throw new Error(
      `INTEGRATION_DATABASE_URL aponta para o banco "${name}". O nome do banco precisa terminar em "_it", porque o spec apaga todos os usuários dele.`,
    );
  }

  return url;
}
