import { Api } from '@notomorrow/domain';
import { requireUserOrTest, UnauthorizedError } from '@/lib/auth';
import { streamChat } from '@/lib/coach-client';
import { createSseStream, sseHeaders } from '@/lib/sse';

/**
 * POST /api/coach/chat — SSE passthrough to the Coach Service.
 */
export async function POST(req: Request) {
  let user: { id: string };
  try {
    user = await requireUserOrTest();
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return new Response(JSON.stringify({ error: err.message }), { status: 401 });
    }
    throw err;
  }

  const body = await req.json().catch(() => null);
  const parsed = Api.ChatRequest.safeParse(body);
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: 'invalid' }), { status: 400 });
  }

  const sse = createSseStream();

  (async () => {
    try {
      for await (const evt of streamChat({
        userId: user.id,
        message: parsed.data.message,
        conversationId: parsed.data.conversationId,
      })) {
        sse.write(evt);
      }
    } catch (err) {
      sse.write({ type: 'error', message: (err as Error).message });
    } finally {
      sse.close();
    }
  })();

  return new Response(sse.stream, { headers: sseHeaders });
}
