// L1 ephemeral memory — per-conversation scratch space for inter-skill state.

export class EphemeralStore {
  private store: Map<string, Record<string, unknown>> = new Map();

  get(conversationId: string): Record<string, unknown> {
    return this.store.get(conversationId) ?? {};
  }

  set(conversationId: string, value: Record<string, unknown>): void {
    this.store.set(conversationId, value);
  }

  merge(conversationId: string, patch: Record<string, unknown>): void {
    const current = this.store.get(conversationId) ?? {};
    this.store.set(conversationId, { ...current, ...patch });
  }

  clear(conversationId: string): void {
    this.store.delete(conversationId);
  }
}

export const ephemeralStore = new EphemeralStore();
