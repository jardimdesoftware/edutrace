import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getServiceStats } from './serviceStats';
import type { ServiceStats } from '../interfaces/ServiceStats';

const API_URL = 'http://api.test';

type FetchCall = { url: string; init: RequestInit };

let calls: FetchCall[];
let originalFetch: typeof fetch;

function respondWith(status: number, data: unknown) {
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response(JSON.stringify(data), {
      status,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;
}

beforeEach(() => {
  calls = [];
  originalFetch = globalThis.fetch;
  process.env.NEXT_PUBLIC_API_EDU_TRACE = API_URL;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('getServiceStats', () => {
  it('reads the service statistics from /students/service-stats with a GET', async () => {
    const stats: ServiceStats = {
      totals: { WAITING: 3, IN_SERVICE: 4, CLOSED: 5 },
      professionals: [
        { id: 7, full_name: 'Ana AEE', in_service: 2, capacity: 15, free: 13 },
        { id: 8, full_name: 'Bia AEE', in_service: 15, capacity: 15, free: 0 },
      ],
      queue: {
        size: 3,
        oldest_queued_at: '2026-10-01T09:30:00.000Z',
        oldest_student: { id: 5, full_name: 'Aluno Mais Antigo' },
      },
    };
    respondWith(200, stats);

    const result = await getServiceStats();

    assert.deepEqual(result, stats);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, `${API_URL}/students/service-stats`);
    assert.equal(calls[0].init.method, 'GET');
  });

  it('rejects with the API message when the level is not allowed', async () => {
    respondWith(403, { message: 'Nível de acesso insuficiente' });

    await assert.rejects(getServiceStats(), {
      message: 'Nível de acesso insuficiente',
    });
  });
});
