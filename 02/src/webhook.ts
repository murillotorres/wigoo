import type { Order } from './types.js';
import type { DedupStore } from './dedup/store.js';
import type { Destination } from './destinations/destination.js';

export type DestinationOutcome = 'sent' | 'skipped_duplicate' | 'failed';

export interface DestinationResult {
  destination: string;
  outcome: DestinationOutcome;
  detail?: string;
}

export interface ProcessResult {
  orderId: string;
  results: DestinationResult[];
}

// Manda o pedido pra cada destino em paralelo e independente:
// falhar num destino não impede o outro (Promise.allSettled, não
// Promise.all). Cada destino só envia se conseguir "reservar" o envio
// no dedupStore — assim o mesmo pedido nunca é enviado duas vezes pro
// mesmo destino.
export async function processOrder(
  order: Order,
  destinations: Destination[],
  dedupStore: DedupStore,
): Promise<ProcessResult> {
  const settled = await Promise.allSettled(
    destinations.map((destination) => sendToDestination(order, destination, dedupStore)),
  );

  const results = settled.map((outcome, index) => {
    if (outcome.status === 'fulfilled') return outcome.value;
    return {
      destination: destinations[index].name,
      outcome: 'failed' as const,
      detail: String(outcome.reason),
    };
  });

  return { orderId: order.orderId, results };
}

async function sendToDestination(
  order: Order,
  destination: Destination,
  dedupStore: DedupStore,
): Promise<DestinationResult> {
  const canSend = await dedupStore.claim(order.orderId, destination.name);
  if (!canSend) {
    return { destination: destination.name, outcome: 'skipped_duplicate' };
  }

  const result = await destination.send(order);

  if (result.ok) {
    await dedupStore.markSucceeded(order.orderId, destination.name);
    return { destination: destination.name, outcome: 'sent' };
  }

  await dedupStore.markFailed(order.orderId, destination.name);
  return { destination: destination.name, outcome: 'failed', detail: result.detail };
}
