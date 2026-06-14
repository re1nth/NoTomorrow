import { z } from 'zod';

/**
 * arch/07-api.md → Webhooks (inbound)
 *
 * A loose envelope for GitHub webhook payloads. Full payload validation is
 * GitHub's job; we only constrain what App API needs to route the event.
 */
export const GithubWebhookEnvelope = z
  .object({
    event: z.enum(['push', 'pull_request', 'ping']),
    deliveryId: z.string().min(1).max(128),
    /** Raw GitHub payload, passed through to the verifier. */
    payload: z.unknown(),
  })
  .strict();
export type GithubWebhookEnvelope = z.infer<typeof GithubWebhookEnvelope>;
