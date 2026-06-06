import { EventEmitter } from "events";

/* eslint-disable @typescript-eslint/no-explicit-any */

// Real-time notification fan-out.
//
// Local delivery always goes through an in-process EventEmitter that the SSE
// route subscribes to. When REDIS_URL is set, publishes are routed through Redis
// pub/sub so every app instance re-emits locally — making real-time push work
// across a horizontally-scaled / multi-instance deployment. Without REDIS_URL it
// stays fully in-process (perfect for dev and single-instance).
const globalForRt = globalThis as unknown as {
  rtEmitter?: EventEmitter;
  rtRedisPub?: any;
  rtRedisInit?: boolean;
};

export const rtEmitter = globalForRt.rtEmitter ?? new EventEmitter();
rtEmitter.setMaxListeners(0); // many concurrent SSE connections
if (process.env.NODE_ENV !== "production") globalForRt.rtEmitter = rtEmitter;

const channel = (userId: string) => `user:${userId}`;
const REDIS_CHANNEL = "rotawise:notify";

function emitLocal(userId: string): void {
  rtEmitter.emit(channel(userId), Date.now());
}

// Lazily connect Redis (publisher + a dedicated subscriber) once per process.
async function initRedis(): Promise<void> {
  if (globalForRt.rtRedisInit || !process.env.REDIS_URL) return;
  globalForRt.rtRedisInit = true;
  try {
    // @ts-ignore optional dependency — only imported when REDIS_URL is configured
    const IORedis = (await import("ioredis")).default;
    globalForRt.rtRedisPub = new IORedis(process.env.REDIS_URL);
    const sub = new IORedis(process.env.REDIS_URL);
    await sub.subscribe(REDIS_CHANNEL);
    sub.on("message", (_ch: string, userId: string) => emitLocal(userId));
  } catch (e) {
    console.error("[realtime] Redis init failed; using in-process delivery:", e);
    globalForRt.rtRedisPub = null;
  }
}
if (process.env.REDIS_URL) void initRedis();

/** Signal that a given user has a new notification. */
export function publishToUser(userId: string): void {
  if (process.env.REDIS_URL && globalForRt.rtRedisPub) {
    // Redis subscriber (this and other instances) re-emits locally.
    globalForRt.rtRedisPub.publish(REDIS_CHANNEL, userId);
  } else {
    emitLocal(userId);
  }
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
