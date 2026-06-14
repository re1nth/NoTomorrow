import { describe, expect, it, vi } from 'vitest';
import { CoachClient, CoachClientError } from '../src/coach-client.js';

const UUID = '22222222-2222-4222-8222-222222222222';
const ISO = '2026-06-14T07:00:00.000Z';

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { 'content-type': 'application/json', ...(init.headers ?? {}) },
  });
}

function makeClient(fakeFetch: typeof fetch): CoachClient {
  return new CoachClient({
    baseUrl: 'http://coach.test',
    token: 'test-token',
    fetch: fakeFetch,
  });
}

describe('CoachClient', () => {
  it('calls /coach/daily with bearer auth and validates the response', async () => {
    const fetchMock = vi.fn(async (url: string | URL, init?: RequestInit) => {
      expect(String(url)).toBe('http://coach.test/coach/daily');
      expect(init?.method).toBe('POST');
      const headers = init?.headers as Record<string, string>;
      expect(headers.authorization).toBe('Bearer test-token');
      return jsonResponse({
        primaryTask: {
          id: UUID,
          milestoneId: UUID,
          title: 'Ship MVP',
          type: 'uppercut',
          estMinutes: 480,
          dueDate: '2026-06-14',
          status: 'pending',
        },
        stretchTask: null,
        coachLine: { body: 'Move.', tone: 'hype' },
      });
    });

    const client = makeClient(fetchMock as unknown as typeof fetch);
    const res = await client.daily({ userId: UUID, localDate: '2026-06-14' });
    expect(res.primaryTask.title).toBe('Ship MVP');
    expect(res.coachLine.tone).toBe('hype');
  });

  it('throws CoachClientError on non-2xx', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ error: 'nope' }, { status: 503 }));
    const client = makeClient(fetchMock as unknown as typeof fetch);
    await expect(client.gradeProof({ proofId: UUID, taskId: UUID, userId: UUID })).rejects.toBeInstanceOf(
      CoachClientError,
    );
  });

  it('returns a parsed /proof/grade response', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({ shipped: true, quality: 4, gaps: [] }),
    );
    const client = makeClient(fetchMock as unknown as typeof fetch);
    const res = await client.gradeProof({ proofId: UUID, taskId: UUID, userId: UUID });
    expect(res.shipped).toBe(true);
    expect(res.quality).toBe(4);
  });

  it('parses /roadmap/recalibrate proposed roadmap', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        proposedRoadmap: {
          id: UUID,
          goalId: UUID,
          generatedAt: ISO,
          modelVersion: 'claude-opus-4.7@2026-06-01',
          graph: [{ id: UUID, title: 'Round 1', order: 0, dependsOn: [] }],
        },
        diff: { added: [], removed: [], retitled: [] },
        generatedAt: ISO,
      }),
    );
    const client = makeClient(fetchMock as unknown as typeof fetch);
    const res = await client.recalibrateRoadmap({
      userId: UUID,
      goalId: UUID,
      isoWeek: '2026-W24',
    });
    expect(res.proposedRoadmap.graph.length).toBe(1);
  });
});
