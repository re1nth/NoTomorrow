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
 *
 * Desktop runtime calls Anthropic directly. The packaged launcher does not
 * ship a Coach Service, so when `NOTOMORROW_RUNTIME=desktop` we read the
 * user's Anthropic key (provided via the Settings page, stored on disk and
 * loaded into `process.env.ANTHROPIC_API_KEY` at boot + on save) and ask
 * Claude for a structured milestone list via tool_use. If the key is
 * missing we yield an `error` pointing the user at /settings.
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
  if (process.env.NOTOMORROW_RUNTIME === 'desktop') {
    yield* anthropicRoadmap(req);
    return;
  }
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

const HORIZON_DAYS: Record<string, number> = {
  '1w': 7,
  '1m': 30,
  '3m': 90,
  '1y': 365,
};

const HORIZON_MILESTONE_COUNT: Record<string, number> = {
  '1w': 3,
  '1m': 4,
  '3m': 6,
  '1y': 8,
};

const COACH_SYSTEM_PROMPT = [
  "You are the corner-man in a Hajime no Ippo–style builder's gym.",
  'You take a builder\'s goal and break it into concrete milestones — each one a "round"',
  'with a specific deliverable. Plain, direct language. No fluff, no abstractions.',
  'Every milestone has to be a tangible artifact (a shipped feature, a measured number,',
  'a recorded skill demo) — not a vague intention. Spread the dueOffsetDays evenly',
  'across the horizon and END on the final day.',
].join(' ');

async function* anthropicRoadmap(req: {
  goalId: string;
  goalTitle: string;
  goalMotivation: string;
  horizon: string;
  targetDate: string;
}): AsyncGenerator<CoachRoadmapEvent> {
  yield { type: 'goal_created', goalId: req.goalId };

  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    yield {
      type: 'error',
      message:
        'No Anthropic API key configured. Open Settings (left rail) and paste your key, then try again.',
    };
    return;
  }

  const horizonDays = HORIZON_DAYS[req.horizon] ?? 30;
  const count = HORIZON_MILESTONE_COUNT[req.horizon] ?? 4;
  const userMessage = [
    `Goal: ${req.goalTitle}`,
    `Why: ${req.goalMotivation || '(unspecified)'}`,
    `Horizon: ${req.horizon} (${horizonDays} days)`,
    `Target date: ${req.targetDate}`,
    `Produce exactly ${count} milestones. The last milestone's dueOffsetDays must equal ${horizonDays}.`,
  ].join('\n');

  let res: Response;
  try {
    res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2048,
        system: COACH_SYSTEM_PROMPT,
        tools: [
          {
            name: 'propose_milestones',
            description: 'Submit the planned milestones for this goal.',
            input_schema: {
              type: 'object',
              properties: {
                milestones: {
                  type: 'array',
                  minItems: count,
                  maxItems: count,
                  items: {
                    type: 'object',
                    properties: {
                      title: { type: 'string', description: 'Short round title (≤80 chars).' },
                      deliverable: {
                        type: 'string',
                        description: 'One sentence: the concrete artifact this round produces.',
                      },
                      dueOffsetDays: {
                        type: 'integer',
                        minimum: 1,
                        description: 'Days after goal creation when this milestone is due.',
                      },
                    },
                    required: ['title', 'deliverable', 'dueOffsetDays'],
                  },
                },
              },
              required: ['milestones'],
            },
          },
        ],
        tool_choice: { type: 'tool', name: 'propose_milestones' },
        messages: [{ role: 'user', content: userMessage }],
      }),
    });
  } catch (err) {
    yield { type: 'error', message: `Anthropic network error: ${(err as Error).message}` };
    return;
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    yield {
      type: 'error',
      message: `Anthropic API ${res.status}: ${body.slice(0, 240) || '(no body)'}`,
    };
    return;
  }

  const json = (await res.json().catch(() => null)) as
    | { content?: Array<{ type: string; input?: unknown }> }
    | null;
  const block = json?.content?.find((b) => b.type === 'tool_use');
  const input = block?.input as { milestones?: unknown } | undefined;
  const milestones = Array.isArray(input?.milestones) ? input!.milestones : null;
  if (!milestones) {
    yield { type: 'error', message: 'Anthropic returned no milestone list.' };
    return;
  }

  for (let i = 0; i < milestones.length; i++) {
    const m = milestones[i] as { title?: unknown; deliverable?: unknown; dueOffsetDays?: unknown };
    const title = typeof m.title === 'string' ? m.title : `Round ${i + 1}`;
    const deliverable = typeof m.deliverable === 'string' ? m.deliverable : '(no description)';
    const dueOffsetDays =
      typeof m.dueOffsetDays === 'number' && Number.isFinite(m.dueOffsetDays)
        ? Math.max(1, Math.round(m.dueOffsetDays))
        : Math.round((horizonDays * (i + 1)) / milestones.length);
    // Light cadence so the UI fills in one milestone at a time rather than dumping.
    await new Promise((r) => setTimeout(r, 200));
    yield {
      type: 'milestone',
      milestone: {
        order: i,
        title,
        deliverable: { kind: 'progress', description: deliverable },
        dueOffsetDays,
      },
    };
  }
  yield { type: 'done', roadmapId: req.goalId };
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
