/**
 * Tiny helpers for emitting SSE streams from Next.js route handlers.
 *
 *   const { stream, write, close } = createSseStream();
 *   write({ type: 'milestone', milestone });
 *   close();
 *   return new Response(stream, { headers: sseHeaders });
 */

export const sseHeaders = {
  'content-type': 'text/event-stream',
  'cache-control': 'no-cache, no-transform',
  connection: 'keep-alive',
} as const;

export function encodeSse(payload: unknown): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(payload)}\n\n`);
}

export interface SseStream {
  stream: ReadableStream<Uint8Array>;
  write: (payload: unknown) => void;
  close: () => void;
}

export function createSseStream(): SseStream {
  let controllerRef: ReadableStreamDefaultController<Uint8Array> | null = null;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controllerRef = controller;
    },
    cancel() {
      controllerRef = null;
    },
  });
  return {
    stream,
    write(payload) {
      if (!controllerRef) return;
      try {
        controllerRef.enqueue(encodeSse(payload));
      } catch {
        controllerRef = null;
      }
    },
    close() {
      if (!controllerRef) return;
      try {
        controllerRef.close();
      } catch {
        // already closed
      }
      controllerRef = null;
    },
  };
}
