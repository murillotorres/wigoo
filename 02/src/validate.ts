import type { Order } from './types.js';

export class InvalidOrderError extends Error {}

// Confere só o essencial pra não quebrar o resto do código.
// Não é uma validação completa de schema — é o suficiente pra recusar
// educadamente um payload claramente errado.
export function parseOrder(raw: unknown): Order {
  if (typeof raw !== 'object' || raw === null) {
    throw new InvalidOrderError('payload não é um objeto');
  }

  const order = raw as Record<string, unknown>;

  if (typeof order.orderId !== 'string' || order.orderId.length === 0) {
    throw new InvalidOrderError('orderId ausente ou inválido');
  }

  if (!Array.isArray(order.items)) {
    throw new InvalidOrderError('items ausente ou inválido');
  }

  for (const rawItem of order.items) {
    const item = rawItem as Record<string, unknown>;
    if (typeof item.sellingPrice !== 'number' || typeof item.quantity !== 'number') {
      throw new InvalidOrderError('item com sellingPrice ou quantity inválido');
    }
  }

  return order as unknown as Order;
}
