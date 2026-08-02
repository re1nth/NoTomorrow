/**
 * POST /api/auth/register — create a new user with email + password.
 *
 * Only relevant in cloud mode (NOTOMORROW_AUTH=cloud). The desktop
 * runtime seeds a single implicit user and never renders a sign-up
 * surface, so this route is unreachable there.
 *
 * The password is bcrypt-hashed before storage. Successful signup
 * returns 201 with the new user id; the client is expected to follow
 * up with the Auth.js Credentials sign-in to establish a session.
 */
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { users } from '@notomorrow/db-sqlite';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';

const RegisterBody = z
  .object({
    email: z.string().trim().toLowerCase().email().max(254),
    password: z.string().min(8).max(200),
  })
  .strict();

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
  // Extremely unlikely — fall back to the random default in the schema.
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

  const existing = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (existing) {
    return NextResponse.json({ error: 'email already registered' }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const handleBase = slugFromEmail(email);
  const handle = (await chooseUniqueHandle(handleBase)) || undefined;
  const timezone = (await readBrowserTimeZone()) ?? undefined;

  const [row] = await db
    .insert(users)
    .values({
      email,
      passwordHash,
      ...(handle ? { handle } : {}),
      ...(timezone ? { timezone } : {}),
    })
    .returning({ id: users.id });

  if (!row) {
    return NextResponse.json({ error: 'insert failed' }, { status: 500 });
  }
  return NextResponse.json({ id: row.id }, { status: 201 });
}
