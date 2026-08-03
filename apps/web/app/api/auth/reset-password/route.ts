/**
 * POST /api/auth/reset-password  { token, password }
 *
 * Looks up the sha256 hash of the token, verifies expiry + unused,
 * enforces the same zxcvbn minimum as signup, updates the user's
 * password_hash, marks the token consumed, and (for hygiene) revokes
 * any outstanding verification codes.
 */
import bcrypt from 'bcryptjs';
import { and, eq, isNull } from 'drizzle-orm';
import {
  emailVerificationCodes,
  passwordResetTokens,
  users,
} from '@notomorrow/db-sqlite';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { MIN_SCORE, scorePassword } from '@/lib/password';
import { hashToken } from '../forgot-password/route';

const Body = z
  .object({
    token: z.string().min(20).max(200),
    password: z.string().min(8).max(200),
  })
  .strict();

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = Body.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid request' }, { status: 400 });
  }
  const { token, password } = parsed.data;

  const tokenHash = hashToken(token);
  const row = await db.query.passwordResetTokens.findFirst({
    where: and(eq(passwordResetTokens.tokenHash, tokenHash), isNull(passwordResetTokens.usedAt)),
  });
  if (!row) {
    return NextResponse.json({ error: 'invalid or expired token' }, { status: 400 });
  }
  if (row.expiresAt.getTime() < Date.now()) {
    return NextResponse.json({ error: 'invalid or expired token' }, { status: 400 });
  }

  const strength = scorePassword(password);
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

  const passwordHash = await bcrypt.hash(password, 10);
  await db.update(users).set({ passwordHash }).where(eq(users.id, row.userId));
  await db
    .update(passwordResetTokens)
    .set({ usedAt: new Date() })
    .where(eq(passwordResetTokens.id, row.id));
  // If the user was mid-verify, wipe stale codes now that the password
  // has been reset — they'll get a fresh code if they need it.
  await db
    .delete(emailVerificationCodes)
    .where(eq(emailVerificationCodes.userId, row.userId));

  return NextResponse.json({ ok: true });
}
