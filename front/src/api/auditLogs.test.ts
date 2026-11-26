import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { exportAuditLogs, listAuditLogs, registrarDownload } from './auditLogs';

const API_URL = 'http://api.test';

let calls: { url: string; method?: string; body?: string }[];
let originalFetch: typeof fetch;

beforeEach(() => {
  calls = [];
  originalFetch = globalThis.fetch;
  process.env.NEXT_PUBLIC_API_EDU_TRACE = API_URL;
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    calls.push({ url, method: init?.method, body: init?.body as string | undefined });
    return new Response(JSON.stringify({ items: [], total: 0, page: 1, pageSize: 50 }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('auditLogs', () => {
  it('lists the log with the filters in the query string', async () => {
    await listAuditLogs({ search: 'ana', page: 2 });

    assert.equal(calls[0].url, `${API_URL}/audit-logs?search=ana&page=2`);
  });

  it('exports with the filters, ignoring the page', async () => {
    await exportAuditLogs({ entity: 'User', page: 3 });

    assert.equal(calls[0].url, `${API_URL}/audit-logs/export?entity=User`);
  });

  it('registers a downloaded PDF', async () => {
    await registrarDownload('StudentReport', 3);
    await registrarDownload('AeeAgenda');

    assert.deepEqual(calls, [
      {
        url: `${API_URL}/audit-logs/downloads`,
        method: 'POST',
        body: JSON.stringify({ entity: 'StudentReport', entity_id: 3 }),
      },
      {
        url: `${API_URL}/audit-logs/downloads`,
        method: 'POST',
        body: JSON.stringify({ entity: 'AeeAgenda' }),
      },
    ]);
  });
});
