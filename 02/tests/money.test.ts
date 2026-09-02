import { test } from 'node:test';
import assert from 'node:assert/strict';
import { centsToDecimal, sumItemsCents } from '../src/money.js';

test('soma dos itens em centavos bate com o value do pedido de exemplo', () => {
  const items = [
    { sellingPrice: 7495, quantity: 2 },
    { sellingPrice: 4000, quantity: 1 },
  ];
  assert.equal(sumItemsCents(items), 18990);
});

test('centavos vira valor decimal', () => {
  assert.equal(centsToDecimal(18990), 189.9);
});
