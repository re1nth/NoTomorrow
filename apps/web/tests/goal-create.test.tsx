import { describe, expect, it } from 'vitest';
import { POST } from '@/app/api/goals/route';
import { signInAs, state } from './setup';

function jsonReq(body: unknown): Request {
  return new Request('http://localhost/api/goals', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/goals', () => {
  it('rejects invalid bodies with 400', async () => {
    signInAs('00000000-0000-7000-8000-000000000001');
    const res = await POST(jsonReq({ title: '' }));
    expect(res.status).toBe(400);
  });

  it('creates a goal and an empty roadmap shell', async () => {
    signInAs('00000000-0000-7000-8000-000000000001');
    const res = await POST(
      jsonReq({
        title: 'Ship the MVP',
        motivation: 'Prove the loop works',
        horizon: '1m',
        targetDate: '2026-07-14',
      }),
    );
    expect(res.status).toBe(201);
    expect(state.goals).toHaveLength(1);
    expect(state.roadmaps).toHaveLength(1);
  });
});
