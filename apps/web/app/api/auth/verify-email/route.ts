/**
 * POST /api/auth/verify-email  { email, code }
 * POST /api/auth/verify-email?resend=1  { email }
 *
 * `verify`: compare bcrypt hash, decrement attempts, on success mark
 *   users.email_verified = now() and delete the code row.
 * `resend`: invalidate any outstanding code and issue a fresh one. A
 *   60-second cooldown per user prevents mailbomb.
 *
 * Both paths always return the same shape for unknown emails so
 * they can't be used to enumerate accounts.
 */
import bcrypt from 'bcryptjs';
import { and, desc, eq } from 'drizzle-orm';
import { emailVerificationCodes, users } from '@notomorrow/db-sqlite';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { sendVerificationCode } from '@/lib/mailer';

const MAX_ATTEMPTS = 5;
const CODE_TTL_MS = 15 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;

const VerifyBody = z
  .object({
    email: z.string().trim().toLowerCase().email().max(254),
    code: z.string().regex(/^\d{6}$/),
  })
  .strict();

const ResendBody = z
  .object({
    email: z.string().trim().toLowerCase().email().max(254),
  })
  .strict();

function newSixDigitCode(): string {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return String((buf[0] as number) % 1_000_000).padStart(6, '0');
}

async function handleResend(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = ResendBody.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid request' }, { status: 400 });
  }
  const { email } = parsed.data;

  const user = await db.query.users.findFirst({ where: eq(users.email, email) });
  // If the user doesn't exist or is already verified, return success
  // silently to avoid leaking account state.
  if (!user || user.emailVerified) {
    return NextResponse.json({ ok: true });
  }

  const latest = await db.query.emailVerificationCodes.findFirst({
    where: eq(emailVerificationCodes.userId, user.id),
    orderBy: [desc(emailVerificationCodes.createdAt)],
  });
  if (latest) {
    const age = Date.now() - new Date(latest.createdAt).getTime();
    if (age < RESEND_COOLDOWN_MS) {
      const wait = Math.ceil((RESEND_COOLDOWN_MS - age) / 1000);
      return NextResponse.json(
        { error: 'wait before requesting a new code', retryAfterSeconds: wait },
        { status: 429 },
      );
    }
  }

  await db.delete(emailVerificationCodes).where(eq(emailVerificationCodes.userId, user.id));

  const code = newSixDigitCode();
  const codeHash = await bcrypt.hash(code, 10);
  await db.insert(emailVerificationCodes).values({
    userId: user.id,
    codeHash,
    expiresAt: new Date(Date.now() + CODE_TTL_MS),
  });
  await sendVerificationCode(email, code);

  return NextResponse.json({ ok: true });
}

async function handleVerify(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = VerifyBody.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid request' }, { status: 400 });
  }
  const { email, code } = parsed.data;

  const user = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (!user) {
    return NextResponse.json({ error: 'invalid or expired code' }, { status: 400 });
  }
  if (user.emailVerified) {
    return NextResponse.json({ ok: true, alreadyVerified: true });
  }

  const row = await db.query.emailVerificationCodes.findFirst({
    where: eq(emailVerificationCodes.userId, user.id),
    orderBy: [desc(emailVerificationCodes.createdAt)],
  });
  if (!row) {
    return NextResponse.json({ error: 'invalid or expired code' }, { status: 400 });
  }
  if (row.expiresAt.getTime() < Date.now()) {
    return NextResponse.json({ error: 'invalid or expired code' }, { status: 400 });
  }
  if (row.attempts >= MAX_ATTEMPTS) {
    return NextResponse.json(
      { error: 'too many attempts, request a new code' },
      { status: 429 },
    );
  }

  const ok = await bcrypt.compare(code, row.codeHash);
  if (!ok) {
    await db
      .update(emailVerificationCodes)
      .set({ attempts: row.attempts + 1 })
      .where(eq(emailVerificationCodes.id, row.id));
    return NextResponse.json({ error: 'invalid or expired code' }, { status: 400 });
  }

  await db
    .update(users)
    .set({ emailVerified: new Date() })
    .where(eq(users.id, user.id));
  await db.delete(emailVerificationCodes).where(eq(emailVerificationCodes.userId, user.id));

  return NextResponse.json({ ok: true });
}

export async function POST(req: Request) {
  const url = new URL(req.url);
  if (url.searchParams.get('resend') === '1') return handleResend(req);
  return handleVerify(req);
}
