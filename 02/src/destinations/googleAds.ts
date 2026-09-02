import type { Destination } from './destination.js';
import { centsToDecimal, sumItemsCents } from '../money.js';
import { fetchWithRetry } from '../http/retry.js';

const GOOGLE_ADS_TOKEN = process.env.GOOGLE_ADS_TOKEN;
const CUSTOMER_ID = process.env.GOOGLE_ADS_CUSTOMER_ID;
const CONVERSION_ACTION = process.env.GOOGLE_ADS_CONVERSION_ACTION;

export const googleAdsDestination: Destination = {
  name: 'google_ads',

  async send(order) {
    if (!GOOGLE_ADS_TOKEN || !CUSTOMER_ID || !CONVERSION_ACTION) {
      return { ok: false, retryable: false, detail: 'credenciais do Google Ads não configuradas' };
    }

    // O código original usava marketingData.utmiCampaign como se fosse o
    // gclid. utmiCampaign é o nome/id de campanha do UTM, não é o mesmo
    // dado que o gclid (identificador de clique do Google). Enviar isso
    // como gclid manda dado errado pro Google Ads.
    //
    // Decisão: não inventar de onde viria o gclid real (o enunciado não
    // informa). Em vez de continuar mandando um valor sabidamente errado,
    // essa versão só envia a conversão se existir um campo gclid de
    // verdade. Sem ele, marca como "não elegível" e registra isso — não
    // finge que enviou. Ver README para o detalhe dessa decisão.
    const gclid = order.marketingData?.gclid ?? null;
    if (!gclid) {
      return {
        ok: false,
        retryable: false,
        detail: 'pedido sem gclid válido; não elegível para conversão por clique',
      };
    }

    const total = centsToDecimal(sumItemsCents(order.items));

    const payload = {
      conversions: [
        {
          gclid,
          conversionAction: CONVERSION_ACTION,
          conversionDateTime: order.creationDate,
          conversionValue: total,
          currencyCode: 'BRL',
          orderId: order.orderId,
        },
      ],
    };

    const result = await fetchWithRetry(
      `https://googleads.googleapis.com/v16/customers/${CUSTOMER_ID}:uploadClickConversions`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${GOOGLE_ADS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      },
    );

    if (result.ok) return { ok: true, retryable: false };
    return { ok: false, retryable: result.retryable, detail: `status ${result.status ?? 'desconhecido'}` };
  },
};
