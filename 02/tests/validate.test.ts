import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseOrder, InvalidOrderError } from '../src/validate.js';

test('payload válido passa direto', () => {
  const order = parseOrder({ orderId: 'abc', items: [{ sellingPrice: 100, quantity: 1 }] });
  assert.equal(order.orderId, 'abc');
});

test('sem orderId falha com erro claro', () => {
  assert.throws(() => parseOrder({ items: [] }), InvalidOrderError);
});

test('items que não é lista falha', () => {
  assert.throws(() => parseOrder({ orderId: 'abc', items: 'não é lista' }), InvalidOrderError);
});

test('item sem sellingPrice numérico falha', () => {
  assert.throws(
    () => parseOrder({ orderId: 'abc', items: [{ sellingPrice: 'grátis', quantity: 1 }] }),
    InvalidOrderError,
  );
});
