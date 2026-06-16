import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { NextResponse } from 'next/server';
import { requireUserOrTest, UnauthorizedError } from '@/lib/auth';

/**
 * Settings persistence. Storage is a JSON file in Electron's userData folder
 * (path is exposed via NOTOMORROW_USER_DATA, set by the desktop launcher).
 * In non-desktop runtimes the routes still respond — they just report that
 * settings are desktop-only — so the page mounts cleanly in web builds too.
 */

interface SettingsFile {
  anthropicApiKey?: string;
}

function userDataDir(): string | null {
  return process.env.NOTOMORROW_USER_DATA ?? null;
}

async function readSettings(dir: string): Promise<SettingsFile> {
  const file = path.join(dir, 'settings.json');
  try {
    const raw = await fs.readFile(file, 'utf8');
    return JSON.parse(raw) as SettingsFile;
  } catch {
    return {};
  }
}

async function writeSettings(dir: string, next: SettingsFile): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, 'settings.json'), JSON.stringify(next, null, 2));
}

function maskKey(key: string): string {
  if (key.length <= 12) return '••••';
  return `${key.slice(0, 7)}…${key.slice(-4)}`;
}

export async function GET() {
  try {
    await requireUserOrTest();
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    throw err;
  }
  const dir = userDataDir();
  if (!dir) {
    return NextResponse.json({ configured: false, desktopOnly: true });
  }
  const settings = await readSettings(dir);
  const key = settings.anthropicApiKey ?? '';
  return NextResponse.json({ configured: key.length > 0, hint: key ? maskKey(key) : undefined });
}

export async function POST(req: Request) {
  try {
    await requireUserOrTest();
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    throw err;
  }
  const dir = userDataDir();
  if (!dir) {
    return NextResponse.json({ error: 'Settings only configurable in desktop mode.' }, { status: 400 });
  }
  const body = (await req.json().catch(() => null)) as { anthropicApiKey?: unknown } | null;
  const key = typeof body?.anthropicApiKey === 'string' ? body.anthropicApiKey.trim() : '';
  if (key.length < 10) {
    return NextResponse.json({ error: 'API key looks too short.' }, { status: 400 });
  }
  const current = await readSettings(dir);
  await writeSettings(dir, { ...current, anthropicApiKey: key });
  // Pick up the new key without needing an app restart.
  process.env.ANTHROPIC_API_KEY = key;
  return NextResponse.json({ configured: true, hint: maskKey(key) });
}
