/**
 * The single HTTP client for the Coach Service (`apps/coach`).
 *
 * All Coach calls in the web app funnel through here. Streaming endpoints
 * (`/roadmap/generate`, `/coach/chat`) return an async iterator of parsed SSE
 * events; JSON endpoints return a typed promise.
 */
import { Api } from '@notomorrow/domain';
import { env } from './env';

// API response types — pulled off the namespaced re-export.
type DailyCoachResponse = Api.DailyCoachResponse;
type GradeProofResponse = Api.GradeProofResponse;
type RoadmapStreamEvent = Api.RoadmapStreamEvent;
type ChatStreamEvent = Api.ChatStreamEvent;

export class CoachClientError extends Error {
  override readonly name = 'CoachClientError';
  constructor(message: string, readonly status: number, readonly body: unknown) {
    super(message);
  }
}

interface CoachConfig {
  baseUrl: string;
  token: string;
  fetchImpl?: typeof fetch;
}

/**
 * Resolved on first call. Reading `env` at module load would trigger Zod
 * validation during `next build` (no infra), so keep it lazy.
 */
let resolved: CoachConfig | null = null;
const overrides: { fetchImpl?: typeof fetch } = {};

function getConfig(): CoachConfig {
  if (!resolved) {
    resolved = {
      baseUrl: env.COACH_SERVICE_URL.replace(/\/+$/, ''),
      token: env.COACH_SERVICE_TOKEN,
    };
  }
  return { ...resolved, fetchImpl: overrides.fetchImpl };
}

function headers() {
  return {
    'content-type': 'application/json',
    authorization: `Bearer ${getConfig().token}`,
  };
}

async function postJson<T>(path: string, body: unknown, parse: (v: unknown) => T): Promise<T> {
  const cfg = getConfig();
  const f = cfg.fetchImpl ?? fetch;
  let res: Response;
  try {
    res = await f(`${cfg.baseUrl}${path}`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(body),
    });
  } catch (err) {
    throw new CoachClientError(
      `Coach Service ${path} network error: ${(err as Error).message}`,
      0,
      null,
    );
  }
  const text = await res.text();
  const parsed = text ? safeJson(text) : null;
  if (!res.ok) {
    throw new CoachClientError(`Coach Service ${path} ${res.status}`, res.status, parsed);
  }
  return parse(parsed);
}

function safeJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}

/** POST /coach/daily */
export function daily(req: { userId: string; localDate: string }): Promise<DailyCoachResponse> {
  return postJson('/coach/daily', req, (v) => Api.DailyCoachResponse.parse(v));
}

/** POST /proof/grade */
export function gradeProof(req: {
  proofId: string;
  taskId: string;
  userId: string;
}): Promise<GradeProofResponse> {
  return postJson('/proof/grade', req, (v) => Api.GradeProofResponse.parse(v));
}

/** POST /roadmap/recalibrate */
export function recalibrateRoadmap(req: {
  userId: string;
  goalId: string;
  isoWeek: string;
}): Promise<unknown> {
  return postJson('/roadmap/recalibrate', req, (v) => v);
}

/**
 * Coach Service emits a richer `MilestoneDraft` per milestone than our domain
 * `Milestone` strict schema. The route adapter persists with computed
 * `dueDate`/`status`/ids; here we surface a loose shape so the route can read
 * the raw fields it needs.
 */
export type CoachMilestoneDraft = {
  order: number;
  title: string;
  deliverable: { kind: string; description: string };
  dueOffsetDays: number;
  tasks?: Array<{ title: string; type: string; estMinutes: number }>;
  rationale?: string;
};

export type CoachRoadmapEvent =
  | { type: 'goal_created'; goalId: string }
  | { type: 'milestone'; milestone: CoachMilestoneDraft }
  | { type: 'done'; roadmapId: string; coachNote?: string }
  | { type: 'error'; message: string };

/**
 * POST /roadmap/generate — SSE generator that yields parsed events.
 * Field names mirror apps/coach RoadmapGenerateRequest.
 */
export async function* streamRoadmap(req: {
  userId: string;
  goalId: string;
  userHandle: string;
  goalTitle: string;
  goalMotivation: string;
  horizon: string;
  targetDate: string;
  ratingSnapshot: { stamina: number; expertise: number };
  domainHint?: string;
  priorGoals?: string[];
}): AsyncGenerator<CoachRoadmapEvent> {
  const cfg = getConfig();
  const f = cfg.fetchImpl ?? fetch;
  const res = await f(`${cfg.baseUrl}/roadmap/generate`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(req),
  });
  if (!res.ok || !res.body) {
    throw new CoachClientError(`Coach Service /roadmap/generate ${res.status}`, res.status, null);
  }
  // Coach's shape diverges from `Api.RoadmapStreamEvent` (richer milestone
  // draft, dueOffsetDays vs dueDate). Pass through as the loose union so the
  // route can adapt. The strict domain shape is what the *web* SSE emits to
  // its own client.
  for await (const evt of parseSse(res.body)) {
    if (
      evt &&
      typeof evt === 'object' &&
      'type' in evt &&
      typeof (evt as { type: unknown }).type === 'string'
    ) {
      yield evt as CoachRoadmapEvent;
    }
  }
  void Api;
}

/**
 * POST /coach/chat — SSE generator that yields parsed chat events.
 */
export async function* streamChat(req: {
  userId: string;
  message: string;
  conversationId?: string;
}): AsyncGenerator<ChatStreamEvent> {
  const cfg = getConfig();
  const f = cfg.fetchImpl ?? fetch;
  const res = await f(`${cfg.baseUrl}/coach/chat`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(req),
  });
  if (!res.ok || !res.body) {
    throw new CoachClientError(`Coach Service /coach/chat ${res.status}`, res.status, null);
  }
  for await (const evt of parseSse(res.body)) {
    const parsed = Api.ChatStreamEvent.safeParse(evt);
    if (parsed.success) yield parsed.data;
  }
}

/**
 * Minimal SSE parser: yields the JSON-parsed `data:` payload of each event.
 * Coach Service emits one JSON object per event (events separated by `\n\n`).
 */
async function* parseSse(body: ReadableStream<Uint8Array>): AsyncGenerator<unknown> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    // Normalize CRLF/CR to LF so the split logic below works for any
    // SSE producer (sse-starlette emits CRLF per the spec).
    buffer += decoder.decode(value, { stream: true }).replace(/\r\n?/g, '\n');
    let idx: number;
    while ((idx = buffer.indexOf('\n\n')) !== -1) {
      const raw = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      const dataLine = raw
        .split('\n')
        .find((l) => l.startsWith('data:'));
      if (!dataLine) continue;
      const payload = dataLine.slice(5).trim();
      if (!payload || payload === '[DONE]') continue;
      try {
        yield JSON.parse(payload);
      } catch {
        // skip unparseable frame
      }
    }
  }
}

/** Test seam — swap in a custom fetch (used by vitest mocks). */
export function __setCoachFetch(fn: typeof fetch | undefined): void {
  overrides.fetchImpl = fn;
}
