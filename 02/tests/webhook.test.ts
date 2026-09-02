import { test } from 'node:test';
import assert from 'node:assert/strict';
import { processOrder } from '../src/webhook.js';
import { InMemoryDedupStore } from '../src/dedup/memoryStore.js';
import type { Order } from '../src/types.js';
import type { Destination } from '../src/destinations/destination.js';

const sampleOrder: Order = {
  orderId: '1440289900001-01',
  status: 'invoiced',
  creationDate: '2026-03-14T17:22:41.000Z',
  value: 18990,
  items: [
    { id: 'SKU-8812', quantity: 2, sellingPrice: 7495 },
    { id: 'SKU-1093', quantity: 1, sellingPrice: 4000 },
  ],
};

function fakeDestination(name: string, ok: boolean, retryable = false): Destination {
  return {
    name,
    async send() {
      return { ok, retryable, detail: ok ? undefined : 'erro simulado' };
    },
  };
}

test('Google falhar não impede o Meta de ser enviado', async () => {
  const store = new InMemoryDedupStore();
  const destinations = [fakeDestination('google_ads', false, true), fakeDestination('meta_capi', true)];

  const result = await processOrder(sampleOrder, destinations, store);

  assert.equal(result.results.find((r) => r.destination === 'google_ads')?.outcome, 'failed');
  assert.equal(result.results.find((r) => r.destination === 'meta_capi')?.outcome, 'sent');
});

test('Meta falhar não impede o Google de ser enviado', async () => {
  const store = new InMemoryDedupStore();
  const destinations = [fakeDestination('google_ads', true), fakeDestination('meta_capi', false, true)];

  const result = await processOrder(sampleOrder, destinations, store);

  assert.equal(result.results.find((r) => r.destination === 'google_ads')?.outcome, 'sent');
  assert.equal(result.results.find((r) => r.destination === 'meta_capi')?.outcome, 'failed');
});

test('o mesmo pedido processado duas vezes não envia duas vezes pro mesmo destino', async () => {
  const store = new InMemoryDedupStore();
  const destinations = [fakeDestination('google_ads', true)];

  await processOrder(sampleOrder, destinations, store);
  const second = await processOrder(sampleOrder, destinations, store);

  assert.equal(second.results[0].outcome, 'skipped_duplicate');
});
