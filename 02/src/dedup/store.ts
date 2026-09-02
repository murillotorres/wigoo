export type DedupStatus = 'PENDING' | 'SUCCEEDED' | 'FAILED';

// A chave da deduplicação é (orderId, destination): um pedido pode e deve
// ser enviado uma vez pra cada destino (Google e Meta), mas nunca duas vezes
// pro mesmo destino.
export interface DedupStore {
  // Tenta "reservar" o envio. Retorna true só para quem pode enviar agora.
  // Se já tiver um envio em andamento ou já concluído com sucesso, retorna
  // false — e ninguém envia de novo.
  claim(orderId: string, destination: string): Promise<boolean>;
  markSucceeded(orderId: string, destination: string): Promise<void>;
  markFailed(orderId: string, destination: string): Promise<void>;
}
