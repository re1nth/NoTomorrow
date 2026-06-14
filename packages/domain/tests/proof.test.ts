import { describe, expect, it } from 'vitest';
import { ProofOfWork, ProofPayload } from '../src/entities/proof.js';
import { SubmitProofRequest } from '../src/api/tasks.js';

const baseProof = {
  id: '33333333-3333-4333-8333-333333333333',
  taskId: '44444444-4444-4444-8444-444444444444',
  submittedAt: '2026-06-14T12:00:00.000Z',
  verifiedAt: null,
  score: null,
};

describe('ProofOfWork schema', () => {
  it('accepts a repo proof', () => {
    const result = ProofOfWork.safeParse({
      ...baseProof,
      kind: 'repo',
      payload: { kind: 'repo', url: 'https://github.com/example/repo' },
    });
    expect(result.success).toBe(true);
  });

  it('accepts a writeup proof with markdown body', () => {
    const result = ProofOfWork.safeParse({
      ...baseProof,
      kind: 'writeup',
      payload: { kind: 'writeup', markdown: '# done' },
    });
    expect(result.success).toBe(true);
  });

  it('rejects a payload kind not matching the discriminator', () => {
    // url + repo payload — Zod's discriminated union rejects this at parse time.
    const result = ProofPayload.safeParse({
      kind: 'url',
      url: 'https://x.example.com',
      // extra field belonging to repo
      commitSha: 'abcdef0',
    });
    // commitSha is unknown to UrlProofPayload (strict), so this must fail.
    expect(result.success).toBe(false);
  });

  it('rejects a proof score outside 1..5', () => {
    const result = ProofOfWork.safeParse({
      ...baseProof,
      kind: 'url',
      payload: { kind: 'url', url: 'https://x.example.com' },
      score: 6,
    });
    expect(result.success).toBe(false);
  });
});

describe('SubmitProofRequest', () => {
  it('accepts a matching kind + payload', () => {
    const result = SubmitProofRequest.safeParse({
      kind: 'video',
      payload: { kind: 'video', url: 'https://loom.com/share/xyz' },
    });
    expect(result.success).toBe(true);
  });

  it('rejects when kind disagrees with payload.kind', () => {
    const result = SubmitProofRequest.safeParse({
      kind: 'video',
      payload: { kind: 'url', url: 'https://x.example.com' },
    });
    expect(result.success).toBe(false);
  });
});
