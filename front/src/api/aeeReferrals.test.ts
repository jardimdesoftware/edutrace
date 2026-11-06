import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  encaminharEstudante,
  listarAvisosDoEncaminhamento,
  marcarAvisosComoVistos,
} from "./aeeReferrals";

const API_URL = "http://api.test";

let calls: { url: string; method: string; body: unknown }[];
let originalFetch: typeof fetch;

beforeEach(() => {
  calls = [];
  originalFetch = globalThis.fetch;
  process.env.NEXT_PUBLIC_API_EDU_TRACE = API_URL;
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    calls.push({
      url,
      method: String(init?.method ?? "GET"),
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    });
    return new Response(JSON.stringify([]), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("aeeReferrals", () => {
  it("encaminharEstudante posts the e-mail and the teacher id", async () => {
    await encaminharEstudante("aluno@discente.ifpe.edu.br", 31);

    assert.deepEqual(calls, [
      {
        url: `${API_URL}/aee-referrals`,
        method: "POST",
        body: { student_email: "aluno@discente.ifpe.edu.br", teacher_id: 31 },
      },
    ]);
  });

  it("listarAvisosDoEncaminhamento reads the notices with a GET", async () => {
    await listarAvisosDoEncaminhamento();

    assert.equal(calls[0].url, `${API_URL}/aee-referrals/notifications`);
    assert.equal(calls[0].method, "GET");
  });

  it("marcarAvisosComoVistos posts the ids of the notices that were shown", async () => {
    await marcarAvisosComoVistos([4, 9]);

    assert.deepEqual(calls, [
      {
        url: `${API_URL}/aee-referrals/notifications/seen`,
        method: "POST",
        body: { ids: [4, 9] },
      },
    ]);
  });
});
