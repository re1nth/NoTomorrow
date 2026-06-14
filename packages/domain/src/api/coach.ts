import { z } from 'zod';
import { CoachTone } from '../enums.js';
import { CoachMessage } from '../entities/coach-message.js';
import { Id } from '../entities/primitives.js';
import { Task } from '../entities/task.js';

/**
 * arch/07-api.md → Coach
 */

export const InboxResponse = z.object({ messages: z.array(CoachMessage) }).strict();
export type InboxResponse = z.infer<typeof InboxResponse>;

export const MarkReadResponse = z.object({ message: CoachMessage }).strict();
export type MarkReadResponse = z.infer<typeof MarkReadResponse>;

/** POST /coach/chat — request body; response is an SSE token stream. */
export const ChatRequest = z
  .object({
    message: z.string().min(1).max(4_000),
    /** Optional client-supplied conversation id for continuity. */
    conversationId: Id.optional(),
  })
  .strict();
export type ChatRequest = z.infer<typeof ChatRequest>;

/** A single SSE event in the chat stream. */
export const ChatStreamEvent = z.discriminatedUnion('type', [
  z
    .object({
      type: z.literal('token'),
      delta: z.string(),
    })
    .strict(),
  z
    .object({
      type: z.literal('done'),
      messageId: Id,
    })
    .strict(),
  z
    .object({
      type: z.literal('error'),
      message: z.string(),
    })
    .strict(),
]);
export type ChatStreamEvent = z.infer<typeof ChatStreamEvent>;

/**
 * Coach service /coach/daily response.
 * arch/TRACKER.md → apps/coach interface contract
 */
export const DailyCoachResponse = z
  .object({
    primaryTask: Task,
    stretchTask: Task.nullable(),
    coachLine: z
      .object({
        body: z.string().min(1).max(2_000),
        tone: CoachTone,
      })
      .strict(),
  })
  .strict();
export type DailyCoachResponse = z.infer<typeof DailyCoachResponse>;
