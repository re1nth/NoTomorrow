import { NextResponse } from 'next/server';
import { Api } from '@notomorrow/domain';
import { env } from '@/lib/env';

/**
 * POST /api/webhooks/github — entry point for repo-scan proof verification.
 *
 * We validate the signature (when a secret is configured) and forward the
 * envelope shape to Coach Service via Inngest in a later iteration. For MVP
 * (URL-only proofs) we only need to accept-and-ack to keep external systems
 * happy; the Inngest fan-out lives in infra/inngest already.
 */
export async function POST(req: Request) {
  const signatureHeader = req.headers.get('x-hub-signature-256');
  const eventHeader = req.headers.get('x-github-event') ?? '';
  const deliveryHeader = req.headers.get('x-github-delivery') ?? '';

  const body = await req.text();

  if (env.GITHUB_WEBHOOK_SECRET) {
    const ok = await verifySignature(body, env.GITHUB_WEBHOOK_SECRET, signatureHeader);
    if (!ok) return NextResponse.json({ error: 'bad signature' }, { status: 401 });
  }

  const payload = safeJson(body);
  const envelope = Api.GithubWebhookEnvelope.safeParse({
    event: eventHeader === 'pull_request' || eventHeader === 'ping' ? eventHeader : 'push',
    deliveryId: deliveryHeader || 'unknown',
    payload,
  });
  if (!envelope.success) {
    return NextResponse.json(
      { error: 'invalid envelope', issues: envelope.error.issues },
      { status: 400 },
    );
  }

  return NextResponse.json({ ok: true, event: envelope.data.event });
}

function safeJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

async function verifySignature(
  body: string,
  secret: string,
  header: string | null,
): Promise<boolean> {
  if (!header || !header.startsWith('sha256=')) return false;
  const expected = header.slice(7);
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
  const hex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return timingSafeEqual(hex, expected);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
