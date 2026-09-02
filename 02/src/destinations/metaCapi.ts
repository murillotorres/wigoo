import { createHash } from 'node:crypto';
import type { Destination } from './destination.js';
import { centsToDecimal, sumItemsCents } from '../money.js';
import { fetchWithRetry } from '../http/retry.js';

const META_PIXEL_ID = process.env.META_PIXEL_ID;
const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;

function hashEmail(email: string): string {
  // Meta exige o e-mail em hash SHA-256 (normalizado: minúsculo, sem espaços).
  return createHash('sha256').update(email.trim().toLowerCase()).digest('hex');
}

function toUnixSeconds(isoDate: string): number {
  return Math.floor(new Date(isoDate).getTime() / 1000);
}

export const metaCapiDestination: Destination = {
  name: 'meta_capi',

  async send(order) {
    if (!META_PIXEL_ID || !META_ACCESS_TOKEN) {
      return { ok: false, retryable: false, detail: 'credenciais do Meta CAPI não configuradas' };
    }

    const total = centsToDecimal(sumItemsCents(order.items));
    const email = order.clientProfileData?.email;

    const payload = {
      data: [
        {
          event_name: 'Purchase',
          event_time: toUnixSeconds(order.creationDate),
          // event_id estável (o próprio orderId): é a deduplicação nativa
          // do Meta. Mesmo que a gente reenvie por engano, o Meta CAPI
          // reconhece o mesmo event_id e não conta duas vezes do lado dele.
          event_id: order.orderId,
          action_source: 'system_generated',
          user_data: email ? { em: [hashEmail(email)] } : {},
          custom_data: {
            currency: 'BRL',
            value: total,
            order_id: order.orderId,
          },
        },
      ],
    };

    const result = await fetchWithRetry(
      `https://graph.facebook.com/v20.0/${META_PIXEL_ID}/events?access_token=${META_ACCESS_TOKEN}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
    );

    if (result.ok) return { ok: true, retryable: false };
    return { ok: false, retryable: result.retryable, detail: `status ${result.status ?? 'desconhecido'}` };
  },
};
