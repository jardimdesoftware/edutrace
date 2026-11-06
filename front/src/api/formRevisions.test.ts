import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { buscarVersao, listarVersoes } from "./formRevisions";

const API_URL = "http://api.test";
// '#' cortaria o resto da URL como fragmento, '?' viraria query string e '/'
// mudaria a rota; os três são válidos na parte local de um e-mail.
const EMAIL = "nome/sobrenome?x#y@edutrace.com";
const ENCODED = "nome%2Fsobrenome%3Fx%23y%40edutrace.com";

let urls: string[];
let originalFetch: typeof fetch;

beforeEach(() => {
  urls = [];
  originalFetch = globalThis.fetch;
  process.env.NEXT_PUBLIC_API_EDU_TRACE = API_URL;
  globalThis.fetch = (async (url: string) => {
    urls.push(url);
    return new Response(JSON.stringify([]), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("formRevisions", () => {
  it("listarVersoes encodes the e-mail in the path", async () => {
    await listarVersoes("ANAMNESIS", EMAIL);

    assert.deepEqual(urls, [`${API_URL}/form-revisions/ANAMNESIS/${ENCODED}`]);
  });

  it("buscarVersao puts the version after the e-mail", async () => {
    await buscarVersao("SCREENING", EMAIL, 3);

    assert.deepEqual(urls, [`${API_URL}/form-revisions/SCREENING/${ENCODED}/3`]);
  });

  it("sends the semester of a PAEE in the query, encoded", async () => {
    await listarVersoes("AEE_PLAN", EMAIL, "2026.1");
    await buscarVersao("AEE_PLAN", EMAIL, 2, "2026.1");

    assert.deepEqual(urls, [
      `${API_URL}/form-revisions/AEE_PLAN/${ENCODED}?record=2026.1`,
      `${API_URL}/form-revisions/AEE_PLAN/${ENCODED}/2?record=2026.1`,
    ]);
  });

  it("does not send a record for the forms that are unique per student", async () => {
    await listarVersoes("CASE_STUDY", EMAIL);

    assert.ok(!urls[0].includes("record="));
  });
});
