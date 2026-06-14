'use client';

/**
 * Client-side re-export of the @notomorrow/ui barrel.
 *
 * Several components in `@notomorrow/ui` (BellRing, KOStamp, useReducedMotion,
 * etc.) rely on React hooks and therefore need a `"use client"` boundary. The
 * upstream package itself does not declare that boundary — and the
 * orchestrator forbade us from editing other packages — so we add the
 * boundary here and route every web-app import through this module.
 *
 * Server components that need *only* purely visual primitives (Card, Button)
 * can still import them directly; in practice the cleanest rule for this
 * codebase is "always import @notomorrow/ui via @/lib/ui".
 */
export {
  Button,
  Card,
  KOStamp,
  BellRing,
  RoundDial,
  RatingSparkline,
  CoachBubble,
  PunchIcon,
  StreakBandage,
  cn,
  useReducedMotion,
  registerSound,
  playSound,
  motionTokens,
  palette,
} from '@notomorrow/ui';

export type {
  ButtonProps,
  ButtonVariant,
  ButtonSize,
  CardProps,
  CardTone,
  KOStampProps,
  BellRingProps,
  RoundDialProps,
  RatingSparklineProps,
  CoachBubbleProps,
  CoachTone,
  BubbleSide,
  PunchIconProps,
  PunchType,
  StreakBandageProps,
  ClassValue,
  SoundId,
  MotionDuration,
  MotionEasing,
} from '@notomorrow/ui';
