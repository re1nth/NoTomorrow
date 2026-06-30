/**
 * Tiny sound trigger helper.
 *
 * Components that take a `sound` prop should call `playSound` only when
 * `sound === true`. Default is OFF.
 *
 * Real audio files are intentionally stubbed; consumer apps wire actual Audio
 * sources via `registerSound` at boot. Safe no-op when given an unknown `id`.
 */

export type SoundId = 'bell' | 'punch' | 'ko' | 'countdown';

const audioCache = new Map<SoundId, HTMLAudioElement | null>();

/**
 * Override the audio source for a given sound id. Apps register URLs at boot.
 */
export function registerSound(id: SoundId, src: string): void {
  if (typeof window === 'undefined') return;
  const audio = new Audio(src);
  audio.preload = 'auto';
  audioCache.set(id, audio);
}

/**
 * Play a registered sound. Safe no-op on the server or when not registered.
 * Errors (autoplay policy, etc.) are swallowed — sound is opt-in, never
 * critical to the UX.
 */
export function playSound(id: SoundId): void {
  if (typeof window === 'undefined') return;
  const audio = audioCache.get(id);
  if (!audio) return;
  try {
    audio.currentTime = 0;
    void audio.play().catch(() => {
      /* autoplay rejected — ignore */
    });
  } catch {
    /* ignore */
  }
}
