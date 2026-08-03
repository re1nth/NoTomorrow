/**
 * POST /api/auth/register — create a new user with email + password.
 *
 * The user is created immediately but with `email_verified = null`, so
 * sign-in via /api/auth/callback/credentials is blocked until they
 * enter the 6-digit code emailed at signup. Passwords are bcrypt-hashed
 * and must clear the zxcvbn MIN_SCORE bar.
 */
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { emailVerificationCodes, users } from '@notomorrow/db-sqlite';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { sendVerificationCode } from '@/lib/mailer';
import { MIN_SCORE, scorePassword } from '@/lib/password';

const RegisterBody = z
  .object({
    email: z.string().trim().toLowerCase().email().max(254),
    password: z.string().min(8).max(200),
  })
  .strict();

const CODE_TTL_MS = 15 * 60 * 1000;

function slugFromEmail(email: string): string {
  const localpart = email.split('@')[0] ?? 'user';
  const slug = localpart
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 24);
  return slug || 'user';
}

async function chooseUniqueHandle(base: string): Promise<string> {
  for (let i = 0; i < 50; i++) {
    const candidate = i === 0 ? base : `${base}-${i}`;
    const existing = await db.query.users.findFirst({
      where: eq(users.handle, candidate),
    });
    if (!existing) return candidate;
  }
  return '';
}

function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

async function readBrowserTimeZone(): Promise<string | null> {
  const store = await cookies();
  const raw = store.get('notomorrow_tz')?.value;
  if (!raw) return null;
  const decoded = decodeURIComponent(raw);
  return isValidTimeZone(decoded) ? decoded : null;
}

function newSixDigitCode(): string {
  // crypto.randomInt would need Node import; a rejection-sampled Math.random
  // is fine for a 6-digit code (equivalent bias is negligible) but let's use
  // Web Crypto to stay uniform.
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return String((buf[0] as number) % 1_000_000).padStart(6, '0');
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = RegisterBody.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid request', issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const { email, password } = parsed.data;

  const strength = scorePassword(password, [email]);
  if (!strength.acceptable) {
    return NextResponse.json(
      {
        error: 'password too weak',
        score: strength.score,
        minScore: MIN_SCORE,
        warning: strength.warning,
        suggestions: strength.suggestions,
      },
      { status: 400 },
    );
  }

  const existing = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (existing) {
    return NextResponse.json({ error: 'email already registered' }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const handleBase = slugFromEmail(email);
  const handle = (await chooseUniqueHandle(handleBase)) || undefined;
  const timezone = (await readBrowserTimeZone()) ?? undefined;

  const [user] = await db
    .insert(users)
    .values({
      email,
      passwordHash,
      ...(handle ? { handle } : {}),
      ...(timezone ? { timezone } : {}),
    })
    .returning({ id: users.id });

  if (!user) {
    return NextResponse.json({ error: 'insert failed' }, { status: 500 });
  }

  const code = newSixDigitCode();
  const codeHash = await bcrypt.hash(code, 10);
  await db.insert(emailVerificationCodes).values({
    userId: user.id,
    codeHash,
    expiresAt: new Date(Date.now() + CODE_TTL_MS),
  });

  await sendVerificationCode(email, code);

  return NextResponse.json(
    { needsVerification: true, email },
    { status: 201 },
  );
}
