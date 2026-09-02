import type { DedupStore, DedupStatus } from './store.js';

// Implementação em memória, só para este exercício rodar e ser testável.
//
// IMPORTANTE (ver README): isso NÃO serve pra produção no Cloud Run, porque
// o Cloud Run pode subir várias instâncias ao mesmo tempo, cada uma com sua
// própria memória. Duas instâncias diferentes não se enxergam, e o pedido
// pode ser enviado duas vezes. Em produção isso precisa de um lugar
// compartilhado com operação atômica: Firestore (transaction), Redis
// (SET NX) ou Postgres/Cloud SQL (constraint de unicidade).
export class InMemoryDedupStore implements DedupStore {
  private entries = new Map<string, DedupStatus>();

  async claim(orderId: string, destination: string): Promise<boolean> {
    const key = this.key(orderId, destination);
    const current = this.entries.get(key);

    // Já está em andamento ou já teve sucesso: não deixa enviar de novo.
    if (current === 'PENDING' || current === 'SUCCEEDED') {
      return false;
    }

    // Não existe ainda, ou a tentativa anterior falhou: pode tentar.
    this.entries.set(key, 'PENDING');
    return true;
  }

  async markSucceeded(orderId: string, destination: string): Promise<void> {
    this.entries.set(this.key(orderId, destination), 'SUCCEEDED');
  }

  async markFailed(orderId: string, destination: string): Promise<void> {
    this.entries.set(this.key(orderId, destination), 'FAILED');
  }

  private key(orderId: string, destination: string): string {
    return `${orderId}:${destination}`;
  }
}
