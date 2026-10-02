import { describe, expect, it } from 'vitest';
import { GET, POST } from '@/app/api/counters/route';
import { signInAs } from './setup';

describe('auth gate', () => {
  it('rejects unauthenticated requests with 401', async () => {
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('returns an empty list for a signed-in user with no counters', async () => {
    signInAs('00000000-0000-7000-8000-000000000001');
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ counters: [] });
  });

  it('returns 409 when creating a duplicate counter name', async () => {
    signInAs('00000000-0000-7000-8000-000000000001');
    const body = JSON.stringify({ name: 'Roadwork' });
    const first = await POST(new Request('http://test.local/api/counters', { method: 'POST', body }));
    expect(first.status).toBe(201);

    const second = await POST(new Request('http://test.local/api/counters', { method: 'POST', body }));
    expect(second.status).toBe(409);
    await expect(second.json()).resolves.toEqual({ error: 'counter name taken' });
  });
});
