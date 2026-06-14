/**
 * Typed HTTP client for the Coach Service (`apps/coach`).
 *
 * Coach Service exposes JSON endpoints (some SSE-streaming). The Inngest
 * functions in this package only call the JSON ones:
 *
 *   - POST /coach/daily        — produce today's primary + stretch task + line
 *   - POST /proof/grade        — verify a ProofOfWork artifact
 *   - POST /roadmap/recalibrate — propose a roadmap diff
 *
 * Response shapes are pulled from `@notomorrow/domain/api` where they exist
 * so this client stays a thin marshaller; locally-declared shapes here are
 * only for endpoints not yet codified in domain.
 *
 * arch/TRACKER.md → apps/coach interface contract
 */
import { z } from 'zod';
import { Api, Id } from '@notomorrow/domain';

/** Environment surface — read once at client construction time. */
export interface CoachClientConfig {
  /** Base URL, e.g. `http://localhost:8001`. No trailing slash. */
  baseUrl: string;
  /** Bearer token; sent as `Authorization: Bearer <token>` on every call. */
  token: string;
  /** Per-request timeout in milliseconds. Defaults to 30s. */
  timeoutMs?: number;
  /**
   * Optional fetch override — wired by tests so they don't have to spin
   * up a real HTTP server.
   */
  fetch?: typeof fetch;
}

/**
 * POST /coach/daily request body.
 *
 * Coach Service computes the user's daily punch from active goals + recent
 * TrainingLog; the caller only needs to identify the user and the user-local
 * date the message is for.
 */
export const DailyCoachRequest = z
  .object({
    userId: Id,
    localDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  })
  .strict();
export type DailyCoachRequest = z.infer<typeof DailyCoachRequest>;

/**
 * POST /proof/grade request body. Coach Service loads the proof artifact
 * itself given the id — we don't ship the payload here to keep the request
 * small and to let Coach re-read the canonical row.
 */
export const GradeProofRequest = z
  .object({
    proofId: Id,
    taskId: Id,
    userId: Id,
  })
  .strict();
export type GradeProofRequest = z.infer<typeof GradeProofRequest>;

// Recalibrate request/response live in `@notomorrow/domain/api` as
// `Api.RecalibrateRoadmapRequest` / `Api.RecalibrateRoadmapResponse`. Local
// aliases kept for ergonomic imports inside this package.
export const RecalibrateRoadmapRequest = Api.RecalibrateRoadmapRequest;
export type RecalibrateRoadmapRequest = Api.RecalibrateRoadmapRequest;
export const RecalibrateRoadmapResponse = Api.RecalibrateRoadmapResponse;
export type RecalibrateRoadmapResponse = Api.RecalibrateRoadmapResponse;

/** Surfaced as a typed error so functions can branch on Coach upstream failure. */
export class CoachClientError extends Error {
  override readonly name = 'CoachClientError';
  constructor(
    message: string,
    readonly status: number,
    readonly body: unknown,
  ) {
    super(message);
  }
}

/**
 * Minimal typed client. Each method validates the response with the
 * matching Zod schema so handler code can rely on the shape.
 */
export class CoachClient {
  private readonly baseUrl: string;
  private readonly token: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(config: CoachClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, '');
    this.token = config.token;
    this.timeoutMs = config.timeoutMs ?? 30_000;
    this.fetchImpl = config.fetch ?? fetch;
  }

  /** POST /coach/daily — see arch/06-coach-loop.md → Daily check-in. */
  async daily(req: DailyCoachRequest): Promise<Api.DailyCoachResponse> {
    return this.post('/coach/daily', DailyCoachRequest.parse(req), Api.DailyCoachResponse);
  }

  /** POST /proof/grade — see arch/06-coach-loop.md → On proof submission. */
  async gradeProof(req: GradeProofRequest): Promise<Api.GradeProofResponse> {
    return this.post('/proof/grade', GradeProofRequest.parse(req), Api.GradeProofResponse);
  }

  /** POST /roadmap/recalibrate — see arch/06-coach-loop.md → Weekly recalibration. */
  async recalibrateRoadmap(
    req: RecalibrateRoadmapRequest,
  ): Promise<RecalibrateRoadmapResponse> {
    return this.post(
      '/roadmap/recalibrate',
      RecalibrateRoadmapRequest.parse(req),
      RecalibrateRoadmapResponse,
    );
  }

  // The generic uses `z.output<S>` so schemas with `.default(...)` (which
  // diverge input vs output) still satisfy the return type.
  private async post<S extends z.ZodTypeAny>(
    path: string,
    body: unknown,
    responseSchema: S,
  ): Promise<z.output<S>> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${this.token}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      const text = await res.text();
      const parsedBody: unknown = text ? safeJsonParse(text) : null;
      if (!res.ok) {
        throw new CoachClientError(
          `Coach Service ${path} returned ${res.status}`,
          res.status,
          parsedBody,
        );
      }
      return responseSchema.parse(parsedBody);
    } finally {
      clearTimeout(timer);
    }
  }
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/**
 * Build a `CoachClient` from `COACH_SERVICE_URL` + `COACH_SERVICE_TOKEN`
 * env vars. Throws at startup if either is missing — fail fast beats a
 * mysterious 401 in production.
 */
export function createCoachClientFromEnv(env: NodeJS.ProcessEnv = process.env): CoachClient {
  const baseUrl = env.COACH_SERVICE_URL;
  const token = env.COACH_SERVICE_TOKEN;
  if (!baseUrl) throw new Error('COACH_SERVICE_URL is required');
  if (!token) throw new Error('COACH_SERVICE_TOKEN is required');
  return new CoachClient({ baseUrl, token });
}
