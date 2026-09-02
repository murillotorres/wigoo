import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchWithRetry } from '../src/http/retry.js';

test('sucesso na primeira tentativa não tenta de novo', async () => {
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  };

  const result = await fetchWithRetry('https://example.com', { method: 'POST' });
  assert.equal(result.ok, true);
  assert.equal(calls, 1);
});

test('erro 500 tenta de novo até dar certo', async () => {
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    if (calls < 2) return new Response('erro', { status: 500 });
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  };

  const result = await fetchWithRetry('https://example.com', { method: 'POST' });
  assert.equal(result.ok, true);
  assert.equal(calls, 2);
});

test('erro 400 não tenta de novo (não é transitório)', async () => {
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return new Response('erro', { status: 400 });
  };

  const result = await fetchWithRetry('https://example.com', { method: 'POST' });
  assert.equal(result.ok, false);
  assert.equal(calls, 1);
});

test('429 esgota as tentativas e retorna falha marcada como retryable', async () => {
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return new Response('rate limited', { status: 429 });
  };

  const result = await fetchWithRetry('https://example.com', { method: 'POST' });
  assert.equal(result.ok, false);
  assert.equal(result.retryable, true);
  assert.equal(calls, 3);
});
