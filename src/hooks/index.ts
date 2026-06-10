import { HookManager } from './hook-manager';
import { postMemoryWriteAnchorHook } from './post-memory-write';

export type { HookEvent, HookEventType, HookHandler, PostMemoryWritePayload } from './hook-manager';
export { HookManager, postMemoryWriteAnchorHook };

export const defaultHookManager = new HookManager();
defaultHookManager.register('post-memory-write', postMemoryWriteAnchorHook);
