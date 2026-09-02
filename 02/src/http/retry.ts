// Retry simples pra chamada de API externa. Só repete erro que faz sentido
// repetir (instabilidade passageira). Erro de validação (4xx, exceto 429)
// não é repetido, porque tentar de novo não vai consertar um payload errado.

const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);
const MAX_ATTEMPTS = 3;
const BASE_DELAY_MS = 300;

export interface FetchResult {
  ok: boolean;
  status?: number;
  retryable: boolean;
  body?: unknown;
}

export async function fetchWithRetry(url: string, init: RequestInit): Promise<FetchResult> {
  let lastResult: FetchResult = { ok: false, retryable: true };

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const response = await fetch(url, init);

      if (response.ok) {
        return { ok: true, status: response.status, retryable: false, body: await safeJson(response) };
      }

      const retryable = RETRYABLE_STATUS.has(response.status);
      lastResult = { ok: false, status: response.status, retryable, body: await safeJson(response) };

      if (!retryable || attempt === MAX_ATTEMPTS) {
        return lastResult;
      }

      const retryAfterMs = parseRetryAfter(response.headers.get('retry-after'));
      await sleep(retryAfterMs ?? backoffMs(attempt));
    } catch {
      // erro de rede / timeout: sempre vale tentar de novo
      lastResult = { ok: false, retryable: true };
      if (attempt === MAX_ATTEMPTS) return lastResult;
      await sleep(backoffMs(attempt));
    }
  }

  return lastResult;
}

function backoffMs(attempt: number): number {
  const base = BASE_DELAY_MS * 2 ** (attempt - 1);
  const jitter = Math.random() * 150;
  return base + jitter;
}

function parseRetryAfter(header: string | null): number | undefined {
  if (!header) return undefined;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) return seconds * 1000;
  return undefined;
}

async function safeJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
