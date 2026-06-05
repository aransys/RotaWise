import { EventEmitter } from "events";

// In-process pub/sub for real-time notification pushes. Works within a single
// Node process (dev and single-instance deployments). For multi-instance/serverless
// you'd swap this for a Redis pub/sub adapter, keeping the same interface.
const globalForRt = globalThis as unknown as { rtEmitter?: EventEmitter };

export const rtEmitter = globalForRt.rtEmitter ?? new EventEmitter();
rtEmitter.setMaxListeners(0); // many concurrent SSE connections
if (process.env.NODE_ENV !== "production") globalForRt.rtEmitter = rtEmitter;

const channel = (userId: string) => `user:${userId}`;

/** Signal that a given user has a new notification. */
export function publishToUser(userId: string): void {
  rtEmitter.emit(channel(userId), Date.now());
}

export function publishToUsers(userIds: string[]): void {
  for (const id of userIds) publishToUser(id);
}

/** Subscribe a handler to a user's notification signals. Returns an unsubscribe fn. */
export function subscribeUser(userId: string, handler: () => void): () => void {
  const ch = channel(userId);
  rtEmitter.on(ch, handler);
  return () => rtEmitter.off(ch, handler);
}
