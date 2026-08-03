/**
 * POST /api/auth/forgot-password  { email }
 *
 * Always returns 200 with the same shape whether the email exists or
 * not, to avoid enumeration. When it does exist, we invalidate prior
 * tokens, mint a fresh URL-safe token (stored as sha256 hash — safe
 * because the token is 256 bits of entropy, no brute-force risk), and
 * log the reset link via the mailer. 60-second cooldown per user.
 */
import { createHash } from 'crypto';
import { desc, eq } from 'drizzle-orm';
import { passwordResetTokens, users } from '@notomorrow/db-sqlite';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { sendPasswordResetLink } from '@/lib/mailer';

const TOKEN_TTL_MS = 60 * 60 * 1000;
const COOLDOWN_MS = 60 * 1000;

const Body = z
  .object({
    email: z.string().trim().toLowerCase().email().max(254),
  })
  .strict();

function newToken(): string {
  const buf = new Uint8Array(32);
  crypto.getRandomValues(buf);
  return Buffer.from(buf)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

async function originFromRequest(): Promise<string> {
  const h = await headers();
  const proto = h.get('x-forwarded-proto') ?? 'http';
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000';
  return `${proto}://${host}`;
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = Body.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid request' }, { status: 400 });
  }
  const { email } = parsed.data;

  const user = await db.query.users.findFirst({ where: eq(users.email, email) });
  // Silent success for unknown / unverified emails.
  if (!user || !user.emailVerified) {
    return NextResponse.json({ ok: true });
  }

  const latest = await db.query.passwordResetTokens.findFirst({
    where: eq(passwordResetTokens.userId, user.id),
    orderBy: [desc(passwordResetTokens.createdAt)],
  });
  if (latest && !latest.usedAt) {
    const age = Date.now() - new Date(latest.createdAt).getTime();
    if (age < COOLDOWN_MS) {
      return NextResponse.json({ ok: true });
    }
  }

  await db.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, user.id));

  const token = newToken();
  await db.insert(passwordResetTokens).values({
    userId: user.id,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
  });

  const origin = await originFromRequest();
  const url = `${origin}/reset-password?token=${encodeURIComponent(token)}`;
  await sendPasswordResetLink(email, url);

  return NextResponse.json({ ok: true });
}
