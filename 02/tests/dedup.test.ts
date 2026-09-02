import { test } from 'node:test';
import assert from 'node:assert/strict';
import { InMemoryDedupStore } from '../src/dedup/memoryStore.js';

test('primeiro claim libera o envio', async () => {
  const store = new InMemoryDedupStore();
  assert.equal(await store.claim('order-1', 'google_ads'), true);
});

test('depois de sucesso, um novo claim é bloqueado (não reenvia)', async () => {
  const store = new InMemoryDedupStore();
  await store.claim('order-1', 'google_ads');
  await store.markSucceeded('order-1', 'google_ads');
  assert.equal(await store.claim('order-1', 'google_ads'), false);
});

test('depois de falha, um novo claim é permitido (retry)', async () => {
  const store = new InMemoryDedupStore();
  await store.claim('order-1', 'google_ads');
  await store.markFailed('order-1', 'google_ads');
  assert.equal(await store.claim('order-1', 'google_ads'), true);
});

test('duas tentativas concorrentes pro mesmo pedido: só uma vence', async () => {
  const store = new InMemoryDedupStore();
  const results = await Promise.all([
    store.claim('order-2', 'meta_capi'),
    store.claim('order-2', 'meta_capi'),
    store.claim('order-2', 'meta_capi'),
  ]);
  assert.equal(results.filter(Boolean).length, 1);
});

test('destinos diferentes não bloqueiam um ao outro', async () => {
  const store = new InMemoryDedupStore();
  assert.equal(await store.claim('order-3', 'google_ads'), true);
  assert.equal(await store.claim('order-3', 'meta_capi'), true);
});
