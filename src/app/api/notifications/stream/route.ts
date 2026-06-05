import { tenantContext } from "@/lib/tenant";
import { subscribeUser } from "@/lib/realtime";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const ctx = await tenantContext();
  if (!ctx) return new Response("Unauthorized", { status: 401 });

  const encoder = new TextEncoder();
  let unsubscribe: () => void = () => {};
  let heartbeat: ReturnType<typeof setInterval> | undefined;

  const stream = new ReadableStream({
    start(controller) {
      const safeEnqueue = (chunk: string) => {
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          /* stream already closed */
        }
      };

      // Initial comment so the browser marks the connection open immediately.
      safeEnqueue(": connected\n\n");

      unsubscribe = subscribeUser(ctx.userId, () => {
        safeEnqueue(`event: notification\ndata: ${Date.now()}\n\n`);
      });

      // Keep-alive so proxies don't drop an idle connection.
      heartbeat = setInterval(() => safeEnqueue(": heartbeat\n\n"), 25_000);
    },
    cancel() {
      unsubscribe();
      if (heartbeat) clearInterval(heartbeat);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
