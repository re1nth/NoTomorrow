/**
 * Lottie JSON re-exports for convenience. Consumer apps can also import the
 * raw files via the package's `./lottie/*.json` subpath exports.
 */
import koStamp from './ko-stamp.json' with { type: 'json' };
import bellRing from './bell-ring.json' with { type: 'json' };
import punchSwoosh from './punch-swoosh.json' with { type: 'json' };

export const lottie = {
  koStamp,
  bellRing,
  punchSwoosh,
} as const;
