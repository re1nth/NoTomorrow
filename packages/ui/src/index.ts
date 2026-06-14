/**
 * @notomorrow/ui — shared visual layer.
 *
 * Exports:
 *  - Components: Button, Card, KOStamp, BellRing, RoundDial, RatingSparkline,
 *    CoachBubble, PunchIcon, StreakBandage
 *  - Theme: motion tokens + palette (Tailwind preset at `/tailwind` subpath)
 *  - Utilities: cn, useReducedMotion, sound helpers
 */

// Components
export { Button } from './components/Button.js';
export type { ButtonProps, ButtonVariant, ButtonSize } from './components/Button.js';

export { Card } from './components/Card.js';
export type { CardProps, CardTone } from './components/Card.js';

export { KOStamp } from './components/KOStamp.js';
export type { KOStampProps } from './components/KOStamp.js';

export { BellRing } from './components/BellRing.js';
export type { BellRingProps } from './components/BellRing.js';

export { RoundDial } from './components/RoundDial.js';
export type { RoundDialProps } from './components/RoundDial.js';

export { RatingSparkline } from './components/RatingSparkline.js';
export type { RatingSparklineProps } from './components/RatingSparkline.js';

export { CoachBubble } from './components/CoachBubble.js';
export type { CoachBubbleProps, CoachTone, BubbleSide } from './components/CoachBubble.js';

export { PunchIcon } from './components/PunchIcon.js';
export type { PunchIconProps, PunchType } from './components/PunchIcon.js';

export { StreakBandage } from './components/StreakBandage.js';
export type { StreakBandageProps } from './components/StreakBandage.js';

// Theme tokens (Tailwind preset itself lives at the `/tailwind` subpath
// to avoid pulling tailwindcss types into the main bundle).
export { motionTokens, palette } from './tailwind.preset.js';
export type { MotionDuration, MotionEasing } from './tailwind.preset.js';

// Utilities
export { cn } from './utils/cn.js';
export type { ClassValue } from './utils/cn.js';
export { useReducedMotion } from './utils/useReducedMotion.js';
export { registerSound, playSound } from './utils/sound.js';
export type { SoundId } from './utils/sound.js';
