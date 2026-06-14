import { describe, expect, it } from 'vitest';
import { GET } from '@/app/api/goals/route';
import { signInAs } from './setup';

describe('auth gate', () => {
  it('rejects unauthenticated requests with 401', async () => {
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('returns an empty list for a signed-in user with no goals', async () => {
    signInAs('00000000-0000-7000-8000-000000000001');
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ goals: [] });
  });
});
