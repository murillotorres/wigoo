import { createServer, type IncomingMessage } from 'node:http';
import { processOrder } from './webhook.js';
import { parseOrder, InvalidOrderError } from './validate.js';
import { InMemoryDedupStore } from './dedup/memoryStore.js';
import { googleAdsDestination } from './destinations/googleAds.js';
import { metaCapiDestination } from './destinations/metaCapi.js';

// Ver README: essa store em memória só funciona com UMA instância rodando.
// É a implementação certa pra este exercício, não pra produção.
const dedupStore = new InMemoryDedupStore();
const destinations = [googleAdsDestination, metaCapiDestination];

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString('utf8');
}

const server = createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200);
    res.end('ok');
    return;
  }

  if (req.method === 'POST' && req.url === '/webhook/vtex-order') {
    let order;
    try {
      const raw = await readBody(req);
      order = parseOrder(JSON.parse(raw));
    } catch (err) {
      const message = err instanceof InvalidOrderError ? err.message : 'JSON inválido';
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: message }));
      return;
    }

    // Não loga o payload inteiro de propósito: ele tem e-mail e CPF do
    // cliente (PII), e não deveria ir pra um log sem necessidade.
    console.log(`recebido pedido ${order.orderId}`);

    const result = await processOrder(order, destinations, dedupStore);
    console.log('resultado', result);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result));
    return;
  }

  res.writeHead(404);
  res.end();
});

const port = Number(process.env.PORT) || 8080;
server.listen(port, () => {
  console.log(`servidor ouvindo na porta ${port}`);
});
