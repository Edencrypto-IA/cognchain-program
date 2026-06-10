export type HookEventType = 'post-memory-write';

export type PostMemoryWritePayload = {
  hash: string;
  model: string;
  timestamp: number;
  source: string;
  metadata?: Record<string, unknown>;
};

export type HookEvent = {
  id: string;
  type: HookEventType;
  occurredAt: string;
  payload: PostMemoryWritePayload;
};

export type HookHandler = (event: HookEvent) => Promise<void>;

export class HookManager {
  private readonly postMemoryWriteHandlers: HookHandler[] = [];

  register(eventType: HookEventType, handler: HookHandler): void {
    if (eventType === 'post-memory-write') {
      this.postMemoryWriteHandlers.push(handler);
    }
  }

  async emit(event: HookEvent): Promise<void> {
    const handlers = event.type === 'post-memory-write' ? this.postMemoryWriteHandlers : [];
    const results = await Promise.allSettled(handlers.map(handler => handler(event)));
    results.forEach(result => {
      if (result.status === 'rejected') {
        console.warn('[HookManager] hook failed', result.reason);
      }
    });
  }

  listHooks(): Array<{ type: HookEventType; handlers: number }> {
    return [
      {
        type: 'post-memory-write',
        handlers: this.postMemoryWriteHandlers.length,
      },
    ];
  }
}
