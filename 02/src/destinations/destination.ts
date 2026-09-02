import type { Order } from '../types.js';

export interface SendOutcome {
  ok: boolean;
  retryable: boolean;
  detail?: string;
}

export interface Destination {
  name: string;
  send(order: Order): Promise<SendOutcome>;
}
