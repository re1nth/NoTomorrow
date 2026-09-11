'use client';

/**
 * Discover POC — reimagining the vertical-scroll photo feed.
 *
 * Instead of endless flick-scrolling, content lives on a bounded 3D surface
 * (the "disco ball"). You steer it with a physical-feeling trackball. The
 * "camera view" frames whatever tile is currently facing forward — that's
 * the photo you're actually looking at. Unseen tiles glow green; once you
 * dwell on one long enough, it fades to gray so you can tell what's left.
 *
 * This file wires three layout variants around the same interaction loop
 * so we can feel which spatial arrangement works best.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { Button } from '@/lib/ui';

// ────────────────────────────────────────────────────────────
// Model
// ────────────────────────────────────────────────────────────

type Photo = {
  id: number;
  phi: number;   // polar angle on the sphere (0 = north pole)
  theta: number; // azimuth
  hue: number;
  label: string;
};

// Fibonacci-sphere distribution: N points spread roughly evenly on a sphere.
function generatePhotos(n: number): Photo[] {
  const golden = Math.PI * (3 - Math.sqrt(5));
  const photos: Photo[] = [];
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / Math.max(1, n - 1)) * 2;
    const phi = Math.acos(y);
    const theta = golden * i;
    photos.push({
      id: i,
      phi,
      theta,
      hue: (i * 360) / n,
      label: String(i + 1).padStart(2, '0'),
    });
  }
  return photos;
}

// Project a point on the unit sphere through the current rotation.
// Returns cartesian coords in [-1, 1]; z > 0 means the point is on the near
// hemisphere (facing the viewer).
function project(phi: number, theta: number, rotX: number, rotY: number) {
  const x0 = Math.sin(phi) * Math.cos(theta);
  const y0 = Math.cos(phi);
  const z0 = Math.sin(phi) * Math.sin(theta);
  const cy = Math.cos(rotY);
  const sy = Math.sin(rotY);
  const x1 = x0 * cy + z0 * sy;
  const z1 = -x0 * sy + z0 * cy;
  const cx = Math.cos(rotX);
  const sx = Math.sin(rotX);
  const y2 = y0 * cx - z1 * sx;
  const z2 = y0 * sx + z1 * cx;
  return { x: x1, y: y2, z: z2 };
}

// ────────────────────────────────────────────────────────────
// Shared state hook
// ────────────────────────────────────────────────────────────

function useDiscoState(count: number) {
  const photos = useMemo(() => generatePhotos(count), [count]);
  const [rotX, setRotX] = useState(0);
  const [rotY, setRotY] = useState(0);
  const [seen, setSeen] = useState<Set<number>>(() => new Set());

  const rotate = useCallback((dx: number, dy: number) => {
    setRotY((v) => v + dx);
    // Pitch is clamped so users can't invert past the poles — matches how a
    // real trackball feels when a physical stop would otherwise be present.
    setRotX((v) => Math.max(-Math.PI / 2, Math.min(Math.PI / 2, v + dy)));
  }, []);

  const reset = useCallback(() => setSeen(new Set()), []);

  // Front-facing tile — the one closest to (0, 0, +1) after rotation.
  const activeId = useMemo(() => {
    let bestId = photos[0]?.id ?? 0;
    let bestZ = -Infinity;
    for (const p of photos) {
      const { z } = project(p.phi, p.theta, rotX, rotY);
      if (z > bestZ) {
        bestZ = z;
        bestId = p.id;
      }
    }
    return bestId;
  }, [photos, rotX, rotY]);

  // Dwell ~700ms on a tile → mark as seen. Long enough to avoid marking
  // things you scrolled past accidentally, short enough that intent counts.
  useEffect(() => {
    if (seen.has(activeId)) return;
    const t = setTimeout(() => {
      setSeen((s) => {
        if (s.has(activeId)) return s;
        const next = new Set(s);
        next.add(activeId);
        return next;
      });
    }, 700);
    return () => clearTimeout(t);
  }, [activeId, seen]);

  // count is always > 0 at the call sites, so photos[0] is a safe fallback.
  const activePhoto = (photos.find((p) => p.id === activeId) ?? photos[0]) as Photo;

  return { photos, rotX, rotY, rotate, seen, activePhoto, reset };
}

type DiscoState = ReturnType<typeof useDiscoState>;

// ────────────────────────────────────────────────────────────
// Trackball
// ────────────────────────────────────────────────────────────

// ~90 speckle dots evenly distributed on a unit sphere — these are what
// gives the trackball its sense of 3D rotation. Reused every render.
const TRACKBALL_SPECKLES: { phi: number; theta: number; radius: number }[] = (() => {
  const arr: { phi: number; theta: number; radius: number }[] = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  const n = 90;
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2;
    arr.push({
      phi: Math.acos(y),
      theta: golden * i,
      // Deterministic pseudo-random dot radius so the surface looks mottled
      // rather than screened, without introducing hydration mismatch.
      radius: 0.55 + (((i * 37) % 100) / 100) * 0.75,
    });
  }
  return arr;
})();

// Three distinctive coloured markers a user can lock their eye onto so
// rotation is unmistakable. Positioned in an equilateral triangle around
// the sphere.
const TRACKBALL_MARKERS: { phi: number; theta: number; color: string }[] = [
  { phi: Math.PI * 0.35, theta: 0, color: '#ef4444' },
  { phi: Math.PI * 0.55, theta: (2 * Math.PI) / 3, color: '#3b82f6' },
  { phi: Math.PI * 0.5, theta: (4 * Math.PI) / 3, color: '#22c55e' },
];

function Trackball({
  onRotate,
  size = 160,
}: {
  onRotate: (dx: number, dy: number) => void;
  size?: number;
}) {
  const dragRef = useRef<{ x: number; y: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  // Internal orientation of the ball. Drives the projected positions of the
  // speckle + marker dots so the surface reads as physically rotating.
  const [rotX, setRotX] = useState(0);
  const [rotY, setRotY] = useState(0);

  const onDown = (e: ReactPointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { x: e.clientX, y: e.clientY };
    setDragging(true);
  };
  const onMove = (e: ReactPointerEvent) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.x;
    const dy = e.clientY - dragRef.current.y;
    dragRef.current = { x: e.clientX, y: e.clientY };
    // One ball-diameter of drag ≈ π rad (half a turn) — matches the tactile
    // sense of rolling a real trackball under your finger.
    const dRotY = (dx / size) * Math.PI;
    const dRotX = (dy / size) * Math.PI;
    setRotY((r) => r + dRotY);
    setRotX((r) => r + dRotX);
    onRotate(dRotY, dRotX);
  };
  const onUp = (e: ReactPointerEvent) => {
    dragRef.current = null;
    setDragging(false);
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // pointer already released
    }
  };

  const yawDeg = ((Math.round((rotY * 180) / Math.PI) % 360) + 360) % 360;

  return (
    <div
      className="relative select-none"
      style={{ width: size, height: size }}
      aria-label="Trackball"
    >
      {/* Socket housing */}
      <div
        aria-hidden
        className="absolute inset-0 rounded-full"
        style={{
          background:
            'radial-gradient(circle at 50% 55%, #1a1a1a, #0a0a0a 60%, #000 100%)',
          boxShadow:
            'inset 0 8px 20px rgba(0,0,0,0.9), inset 0 -4px 12px rgba(255,255,255,0.03), 0 4px 12px rgba(0,0,0,0.5)',
        }}
      />
      {/* Ball surface — receives pointer events */}
      <div
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        role="slider"
        aria-label="Drag to rotate the disco ball"
        aria-valuenow={yawDeg}
        aria-valuemin={0}
        aria-valuemax={360}
        tabIndex={0}
        className={`absolute rounded-full touch-none overflow-hidden ${
          dragging ? 'cursor-grabbing' : 'cursor-grab'
        }`}
        style={{
          inset: '10%',
          background:
            'radial-gradient(circle at 50% 50%, #c9931e 0%, #7a520a 55%, #2c1c00 100%)',
        }}
      >
        {/* Mottled speckle field — projected in 3D so it moves *around* the
            sphere, not just spinning flat. */}
        {TRACKBALL_SPECKLES.map((s, i) => {
          const { x, y, z } = project(s.phi, s.theta, rotX, rotY);
          if (z < -0.02) return null;
          const depth = (z + 1) / 2;
          const scale = 0.55 + depth * 0.85;
          const opacity = 0.22 + depth * 0.55;
          const r = s.radius * scale;
          return (
            <div
              key={i}
              className="absolute rounded-full pointer-events-none"
              style={{
                width: r * 2,
                height: r * 2,
                left: `${50 + x * 47}%`,
                // Flip Y so world-north sits at the top of the ball; drag-down
                // then translates the visible surface downward, as expected.
                top: `${50 - y * 47}%`,
                transform: 'translate(-50%, -50%)',
                opacity,
                background: 'rgba(15, 8, 0, 0.95)',
              }}
            />
          );
        })}
        {/* Coloured markers — three fixed points on the ball. At any
            orientation at least one is on the near face, so the eye has
            something concrete to track as you drag. */}
        {TRACKBALL_MARKERS.map((m, i) => {
          const { x, y, z } = project(m.phi, m.theta, rotX, rotY);
          if (z < -0.05) return null;
          const depth = (z + 1) / 2;
          const scale = 0.6 + depth * 0.9;
          const r = 4 * scale;
          return (
            <div
              key={i}
              className="absolute rounded-full pointer-events-none"
              style={{
                width: r * 2,
                height: r * 2,
                left: `${50 + x * 46}%`,
                top: `${50 - y * 46}%`,
                transform: 'translate(-50%, -50%)',
                opacity: 0.5 + depth * 0.5,
                background: m.color,
                boxShadow: `0 0 ${4 * depth}px ${m.color}`,
              }}
            />
          );
        })}
        {/* Fixed specular highlight — a reflection of the room light, so it
            stays put while the ball rotates under it. */}
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none rounded-full"
          style={{
            background:
              'radial-gradient(ellipse 45% 32% at 32% 24%, rgba(255,238,180,0.55), transparent 65%)',
          }}
        />
        {/* Rim darkening — sells the sphere silhouette. */}
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none rounded-full"
          style={{
            boxShadow:
              'inset -12px -18px 28px rgba(0,0,0,0.55), inset 8px 10px 14px rgba(255,255,255,0.06)',
          }}
        />
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Disco ball
// ────────────────────────────────────────────────────────────

function DiscoBall({
  photos,
  rotX,
  rotY,
  seen,
  activeId,
  size = 320,
}: {
  photos: Photo[];
  rotX: number;
  rotY: number;
  seen: Set<number>;
  activeId: number;
  size?: number;
}) {
  const r = size / 2;
  return (
    <div
      className="relative rounded-full overflow-hidden"
      style={{
        width: size,
        height: size,
        background:
          'radial-gradient(circle at 30% 28%, #2a2a3a, #10101a 60%, #05050a)',
        boxShadow:
          'inset -10px -20px 40px rgba(0,0,0,0.8), inset 8px 12px 24px rgba(180,180,220,0.15), 0 8px 24px rgba(0,0,0,0.55)',
      }}
    >
      {photos.map((p) => {
        const { x, y, z } = project(p.phi, p.theta, rotX, rotY);
        // Skip the far hemisphere entirely — no depth-of-field trickery
        // needed for a POC; the sphere silhouette does the occlusion.
        if (z < -0.05) return null;
        const depth = (z + 1) / 2; // 0 (back) → 1 (front)
        const scale = 0.6 + depth * 0.5;
        const opacity = 0.35 + depth * 0.65;
        const tile = 30 * scale;
        const isSeen = seen.has(p.id);
        const isActive = p.id === activeId;
        return (
          <div
            key={p.id}
            className="absolute rounded-md flex items-center justify-center text-[10px] font-display transition-[box-shadow,filter] duration-300"
            style={{
              width: tile,
              height: tile,
              left: r + x * r * 0.9 - tile / 2,
              // Screen-Y grows downward but world-Y grows upward, so subtract:
              // now north pole renders at the top and drag-down feels like
              // pulling the surface down.
              top: r - y * r * 0.9 - tile / 2,
              opacity,
              background: isSeen
                ? `hsl(${p.hue} 15% 40%)`
                : `linear-gradient(135deg, hsl(${p.hue} 82% 58%), hsl(${(p.hue + 40) % 360} 70% 40%))`,
              filter: isSeen ? 'saturate(0.35) brightness(0.7)' : 'none',
              boxShadow: isActive
                ? '0 0 0 2px #ffffff, 0 0 18px 4px rgba(255,255,255,0.55)'
                : isSeen
                  ? 'inset 0 0 0 1px rgba(255,255,255,0.05)'
                  : '0 0 0 1.5px #4ade80, 0 0 10px rgba(74,222,128,0.55)',
              zIndex: Math.round((z + 1) * 100),
            }}
            aria-hidden
          >
            <span className="text-white/85 mix-blend-difference tabular-nums">
              {p.label}
            </span>
          </div>
        );
      })}
      {/* Equator highlight — sells the "chrome sphere" look. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-full"
        style={{
          background:
            'radial-gradient(ellipse 80% 6% at 50% 42%, rgba(255,255,255,0.15), transparent 70%)',
        }}
      />
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Camera view
// ────────────────────────────────────────────────────────────

function CameraView({
  photo,
  width = 240,
  aspect = '9 / 16',
}: {
  photo: Photo;
  width?: number;
  aspect?: string;
}) {
  // Trigger the entry animation whenever the front-facing photo changes.
  const [tick, setTick] = useState(0);
  useEffect(() => {
    setTick((t) => t + 1);
  }, [photo.id]);

  return (
    <div
      className="relative rounded-2xl overflow-hidden border border-charcoal/40 bg-black shadow-2xl"
      style={{ width, aspectRatio: aspect }}
      aria-live="polite"
      aria-label={`Now viewing photo ${photo.label}`}
    >
      <div
        key={tick}
        className="absolute inset-0 flex items-center justify-center disco-camera-in"
        style={{
          background: `linear-gradient(135deg, hsl(${photo.hue} 85% 55%), hsl(${(photo.hue + 55) % 360} 70% 30%))`,
        }}
      >
        <div className="font-display text-6xl text-white/95 drop-shadow-lg tabular-nums">
          {photo.label}
        </div>
      </div>
      {/* Viewfinder chrome */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-2 left-2 text-[10px] font-display uppercase tracking-wider text-white/80 flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
          Live
        </div>
        <div className="absolute bottom-2 right-2 text-[10px] font-display text-white/60 tabular-nums">
          #{photo.label}
        </div>
        <div className="absolute inset-2 rounded-xl border border-white/15 pointer-events-none" />
        {[
          'top-1.5 left-1.5 border-l border-t',
          'top-1.5 right-1.5 border-r border-t',
          'bottom-1.5 left-1.5 border-l border-b',
          'bottom-1.5 right-1.5 border-r border-b',
        ].map((cls) => (
          <div
            key={cls}
            className={`absolute w-3 h-3 border-white/80 ${cls}`}
          />
        ))}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Shared UI bits
// ────────────────────────────────────────────────────────────

function ProgressChip({ state }: { state: DiscoState }) {
  const { photos, seen } = state;
  return (
    <div className="text-xs font-display uppercase tracking-wider text-charcoal-soft flex items-center gap-3">
      <span>
        <span className="tabular-nums text-charcoal">{seen.size}</span>
        <span className="text-charcoal-soft"> / {photos.length} seen</span>
      </span>
      <button
        type="button"
        onClick={state.reset}
        className="normal-case tracking-normal text-charcoal-soft hover:text-glove underline underline-offset-2 text-[11px]"
      >
        reset
      </button>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Variants
// ────────────────────────────────────────────────────────────

function StudioVariant({ state }: { state: DiscoState }) {
  const { photos, rotX, rotY, rotate, seen, activePhoto } = state;
  return (
    <div className="flex flex-col items-center gap-6">
      <ProgressChip state={state} />
      <div className="flex items-center justify-center gap-8 flex-wrap">
        <DiscoBall
          photos={photos}
          rotX={rotX}
          rotY={rotY}
          seen={seen}
          activeId={activePhoto.id}
          size={280}
        />
        <CameraView photo={activePhoto} width={220} />
        <Trackball onRotate={rotate} size={160} />
      </div>
      <p className="text-xs text-charcoal-soft max-w-md text-center">
        Drag the trackball to rotate the sphere. The tile facing you snaps
        into the camera view; dwell on it and its green marker fades.
      </p>
    </div>
  );
}

function ViewfinderVariant({ state }: { state: DiscoState }) {
  const { photos, rotX, rotY, rotate, seen, activePhoto } = state;
  return (
    <div className="flex flex-col items-center gap-6">
      <ProgressChip state={state} />
      <div className="relative">
        <CameraView photo={activePhoto} width={300} />
        {/* Minimap disco ball floats over the top-right corner. */}
        <div className="absolute -top-4 -right-4">
          <DiscoBall
            photos={photos}
            rotX={rotX}
            rotY={rotY}
            seen={seen}
            activeId={activePhoto.id}
            size={120}
          />
        </div>
      </div>
      <Trackball onRotate={rotate} size={180} />
      <p className="text-xs text-charcoal-soft max-w-md text-center">
        Camera holds the stage. The disco ball is a peripheral map of what's
        left — glance at the greens to plan a route with the trackball.
      </p>
    </div>
  );
}

function CockpitVariant({ state }: { state: DiscoState }) {
  const { photos, rotX, rotY, rotate, seen, activePhoto } = state;
  return (
    <div className="flex flex-col items-center gap-4">
      <ProgressChip state={state} />
      <div
        className="relative w-full max-w-[360px] rounded-3xl border border-charcoal/30 bg-black/70 overflow-hidden shadow-2xl"
        style={{ aspectRatio: '9 / 19.5' }}
      >
        {/* Phone-frame simulation: camera stretches across the top ~65%. */}
        <div className="absolute inset-x-0 top-0 bottom-[38%] flex items-center justify-center p-3">
          <CameraView photo={activePhoto} width={280} aspect="9 / 14" />
        </div>
        {/* Tiny disco ball minimap in the top-right corner. */}
        <div className="absolute top-3 right-3">
          <DiscoBall
            photos={photos}
            rotX={rotX}
            rotY={rotY}
            seen={seen}
            activeId={activePhoto.id}
            size={72}
          />
        </div>
        {/* Trackball dominates the bottom for thumb reach. */}
        <div className="absolute inset-x-0 bottom-6 flex items-center justify-center">
          <Trackball onRotate={rotate} size={150} />
        </div>
      </div>
      <p className="text-xs text-charcoal-soft max-w-md text-center">
        One-hand mode. Thumb sits on the trackball; the camera swaps as you
        steer. Corner minimap only draws the eye when green tiles remain.
      </p>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Shell with variant switcher
// ────────────────────────────────────────────────────────────

type VariantKey = 'studio' | 'viewfinder' | 'cockpit';

const VARIANTS: { key: VariantKey; label: string }[] = [
  { key: 'studio', label: 'Studio' },
  { key: 'viewfinder', label: 'Viewfinder' },
  { key: 'cockpit', label: 'Cockpit' },
];

function isVariantKey(v: string): v is VariantKey {
  return v === 'studio' || v === 'viewfinder' || v === 'cockpit';
}

export function DiscoverPOC() {
  // The body of this POC is all inline-styled with computed floats, gradient
  // shorthands, and hsl()/hex colours — every one of those normalizes
  // differently in the DOM vs. what React emits, so SSR'd markup can't hydrate
  // cleanly against it. Since none of it is meaningful until interaction
  // starts anyway, gate the render on mount: the server sends a tiny
  // placeholder, the client swaps in the real thing, no attributes to
  // mismatch.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const state = useDiscoState(24);
  const [variant, setVariant] = useState<VariantKey>('studio');

  // Sync with URL hash so /discover#viewfinder deep-links to a variant.
  // Handy for screenshots and shareable comparisons.
  useEffect(() => {
    if (!mounted) return;
    const apply = () => {
      const h = window.location.hash.replace(/^#/, '');
      if (isVariantKey(h)) setVariant(h);
    };
    apply();
    window.addEventListener('hashchange', apply);
    return () => window.removeEventListener('hashchange', apply);
  }, [mounted]);

  const pick = (v: VariantKey) => {
    setVariant(v);
    if (typeof window !== 'undefined') {
      history.replaceState(null, '', `#${v}`);
    }
  };

  if (!mounted) {
    return (
      <div className="flex items-center justify-center min-h-[560px]">
        <div className="text-xs font-display uppercase tracking-wider text-charcoal-soft">
          Loading…
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="flex gap-2 flex-wrap justify-center">
        {VARIANTS.map((v) => (
          <Button
            key={v.key}
            size="sm"
            variant={variant === v.key ? 'primary' : 'ghost'}
            onClick={() => pick(v.key)}
          >
            {v.label}
          </Button>
        ))}
      </div>
      <div className="w-full">
        {variant === 'studio' && <StudioVariant state={state} />}
        {variant === 'viewfinder' && <ViewfinderVariant state={state} />}
        {variant === 'cockpit' && <CockpitVariant state={state} />}
      </div>
    </div>
  );
}
