import { describe, expect, it } from 'vitest';
import { POST } from '@/app/api/tasks/[id]/proof/route';
import { signInAs, state } from './setup';

function jsonReq(body: unknown): Request {
  return new Request('http://localhost/api/tasks/x/proof', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/tasks/:id/proof', () => {
  it('rejects without auth', async () => {
    const res = await POST(jsonReq({}), { params: Promise.resolve({ id: 't1' }) });
    expect(res.status).toBe(401);
  });

  it('rejects malformed payloads', async () => {
    signInAs('00000000-0000-7000-8000-000000000001');
    const res = await POST(
      jsonReq({ kind: 'url', payload: { kind: 'repo', url: 'http://x' } }),
      { params: Promise.resolve({ id: 't1' }) },
    );
    expect(res.status).toBe(400);
  });

  it('persists a URL proof for an existing task', async () => {
    signInAs('00000000-0000-7000-8000-000000000001');
    state.tasks.push({ id: 't1', milestoneId: 'm1' });
    const res = await POST(
      jsonReq({
        kind: 'url',
        payload: { kind: 'url', url: 'https://shipped.example.com' },
      }),
      { params: Promise.resolve({ id: 't1' }) },
    );
    expect(res.status).toBe(200);
    expect(state.proofs).toHaveLength(1);
  });
});
