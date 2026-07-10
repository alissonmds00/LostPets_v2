import type { WebSocket } from 'ws';

// "Quem está online pra messaging" é um conceito de domínio deste módulo
// (não plumbing técnico genérico), então fica em modules/messaging/ — mas
// não passa por dependency-injection (app.decorate): é um singleton
// module-local (a instância exportada abaixo), importada direto por
// messaging.routes.ts (register/unregister na conexão) e por app.ts (pra
// injetar no construtor de MessagingService, que a usa pra tentar entregar
// mensagens). Decidido com o usuário em 2026-07-09.
export class MessagingConnectionRegistry {
  // Um Set por usuário (não um socket só) — múltiplas abas/dispositivos
  // conectados ao mesmo tempo devem todos receber a mensagem.
  private readonly socketsByUser = new Map<string, Set<WebSocket>>();

  register(userId: string, socket: WebSocket): void {
    const sockets = this.socketsByUser.get(userId) ?? new Set<WebSocket>();
    sockets.add(socket);
    this.socketsByUser.set(userId, sockets);
  }

  unregister(userId: string, socket: WebSocket): void {
    const sockets = this.socketsByUser.get(userId);
    if (!sockets) return;
    sockets.delete(socket);
    if (sockets.size === 0) this.socketsByUser.delete(userId);
  }

  getSockets(userId: string): Set<WebSocket> {
    return this.socketsByUser.get(userId) ?? new Set<WebSocket>();
  }
}

export const messagingConnectionRegistry = new MessagingConnectionRegistry();
