import { sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sqliteDbPath } from '@/lib/db-config';
import { serviceRole } from '@/lib/service-role';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const dbPath = sqliteDbPath();
    await db.run(sql`select 1`);
    return NextResponse.json({
      ok: true,
      role: serviceRole(),
      database: 'ok',
      configured: Boolean(process.env.SQLITE_DB_PATH?.trim()),
      path: process.env.NODE_ENV === 'production' ? undefined : dbPath,
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        role: serviceRole(),
        database: 'error',
        error: err instanceof Error ? err.message : 'unknown error',
      },
      { status: 503 },
    );
  }
}
