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

// What happens when a task is seen. Declared up here so useDiscoState can
// take it as a parameter; the palette constants that go with it stay next
// to the marker rendering below.
type SeenBehavior = 'dust' | 'ember';

function useDiscoState(count: number, behavior: SeenBehavior) {
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

  // Front-facing task — the photo with the highest z after rotation.
  //
  // In 'dust' mode a snapped-away task is *gone* from the map, so it
  // must not be a candidate for the viewfinder either. In 'ember' mode
  // viewed markers stay on the sphere (amber) and can be revisited, so
  // they remain candidates.
  const activeId = useMemo(() => {
    let bestId: number | null = null;
    let bestZ = -Infinity;
    for (const p of photos) {
      if (behavior === 'dust' && seen.has(p.id)) continue;
      const { z } = project(p.phi, p.theta, rotX, rotY);
      if (z > bestZ) {
        bestZ = z;
        bestId = p.id;
      }
    }
    return bestId;
  }, [photos, rotX, rotY, behavior, seen]);

  // Short dwell (~120ms) — long enough for the "bulge" active-state to
  // register visually, but short enough that a pause on a task still
  // marks it as seen.
  //
  // Cascade guard: when a mark completes in dust mode, `seen` grows AND
  // `activeId` auto-promotes to the next-nearest unseen photo. If we
  // scheduled a new dwell timer on that render, the next task would snap
  // away before the user ever saw it — the "everything vanished" bug.
  // So on any render where `seen` changed, we bail; the next render
  // triggered by rotation will re-enable dwell.
  //
  // Rotation deps: without `rotX`/`rotY` in the deps list, this effect
  // never re-fires once `activeId` becomes stable — which is exactly
  // what happens when only one task remains unseen. It then sits in the
  // viewfinder forever, never marked. Including the rotation values makes
  // the effect fire on drag, arming the dwell timer.
  const prevSeenRef = useRef<Set<number>>(seen);
  useEffect(() => {
    const seenChanged = prevSeenRef.current !== seen;
    prevSeenRef.current = seen;
    if (seenChanged) return;
    if (activeId === null || seen.has(activeId)) return;
    // Ember dwell is much shorter than dust: marking is reversible (the
    // amber marker stays on the sphere), so we can afford to be snappy.
    // Dust stays at ~120ms so a fast fling doesn't accidentally nuke a
    // handful of tasks.
    const dwellMs = behavior === 'dust' ? 120 : 40;
    const t = setTimeout(() => {
      setSeen((s) => {
        if (s.has(activeId)) return s;
        const next = new Set(s);
        next.add(activeId);
        return next;
      });
    }, dwellMs);
    return () => clearTimeout(t);
  }, [activeId, seen, rotX, rotY, behavior]);

  const activePhoto =
    activeId !== null
      ? (photos.find((p) => p.id === activeId) ?? null)
      : null;

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
//
// A mirrored silver sphere tiled with hundreds of tiny polygon facets.
// Each facet catches the "room light" differently depending on which
// direction it's facing, so the whole ball shimmers as you rotate it —
// the way a real disco ball does.
//
// A subset of the facets are TASK MARKERS: same polygon-on-sphere shape
// as the silver flakes, but vividly coloured. Each marker = one
// discoverable post. When a marker's post is "seen" (dwelled on in the
// camera view), it disintegrates like the Thanos snap in Endgame:
// ~24 coloured particles drift outward, blur, and fade to nothing.
// ────────────────────────────────────────────────────────────

// Silver flakes — Fibonacci-distributed and heavily overlapped so the
// surface reads as one continuous mirrored skin rather than a scatter of
// dots on a base. Each has a stable rotation + shade seed so re-renders
// don't reshuffle them.
const SILVER_FLAKES: {
  phi: number;
  theta: number;
  rot: number;
  shadeVar: number;
  sizeVar: number;
}[] = (() => {
  const arr: {
    phi: number;
    theta: number;
    rot: number;
    shadeVar: number;
    sizeVar: number;
  }[] = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  const n = 720;
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2;
    const phi = Math.acos(y);
    const theta = golden * i;
    const seed = (i + 1) * 991;
    arr.push({
      phi,
      theta,
      // Tighter rotation range: adjacent flakes align better into an
      // implied tessellation instead of reading as random confetti.
      rot: (seed % 50) - 25,
      shadeVar: ((seed * 3) % 100) / 100,
      sizeVar: ((seed * 7) % 100) / 100,
    });
  }
  return arr;
})();

// Single-hue palette for everything content-related on the sphere.
// Green = discoverable, amber = viewed (only used in the 'ember' variant).
const CONTENT_HUE_UNSEEN = 145;
const CONTENT_HUE_VIEWED = 30;

// Fixed "room light" direction — matches the specular hotspot painted
// into the sphere base (top-left). Facets facing this direction shine.
const LIGHT_DIR = (() => {
  const v = { x: -0.35, y: 0.55, z: 0.85 };
  const len = Math.hypot(v.x, v.y, v.z);
  return { x: v.x / len, y: v.y / len, z: v.z / len };
})();

function SilverFlake({
  flake,
  rotX,
  rotY,
  r,
}: {
  flake: (typeof SILVER_FLAKES)[number];
  rotX: number;
  rotY: number;
  r: number;
}) {
  const { x, y, z } = project(flake.phi, flake.theta, rotX, rotY);
  if (z < -0.05) return null;
  const depth = (z + 1) / 2;
  // Simple diffuse shading: bright when the flake faces the light.
  const dot = Math.max(0, x * LIGHT_DIR.x + y * LIGHT_DIR.y + z * LIGHT_DIR.z);
  const brightness = Math.min(1, 0.3 + dot * (0.7 + flake.shadeVar * 0.2));
  // Larger overlapping flakes → the sphere reads as a continuous mirrored
  // skin. The extra bytes are cheap; the "gapless" impression is not.
  const size = (10 + flake.sizeVar * 6) * (0.6 + depth * 0.6);
  const light = Math.round(brightness * 100);
  const hot = brightness > 0.78;
  return (
    <div
      className="absolute pointer-events-none"
      style={{
        width: size,
        height: size,
        left: r + x * r * 0.94 - size / 2,
        top: r - y * r * 0.94 - size / 2,
        transform: `rotate(${flake.rot}deg)`,
        backgroundColor: `hsl(215, 10%, ${light}%)`,
        // Sharp corners so overlapping quads read as flat mirror facets,
        // not confetti dots.
        borderRadius: 0,
        boxShadow: hot
          ? `0 0 ${brightness * 4}px hsla(210, 40%, 96%, ${brightness * 0.7})`
          : undefined,
        opacity: 0.9 + depth * 0.1,
        zIndex: Math.round((z + 1) * 200),
      }}
    />
  );
}

// One coloured facet — same shape family as the silver flakes, but
// clearly a task.
//
// Dust behaviour needs a small state machine so the dusting→gone
// transition can play out on its own 1800ms timer after the mark. Ember
// behaviour, on the other hand, has no timed transition — amber is
// purely a derived visual of `isSeen`. Routing ember through the phase
// state machine added an extra render cycle on top of the CSS transition,
// which read as lag. So the marker only tracks phase for dust; ember
// renders straight from props.
function ContentMarker({
  photo,
  rotX,
  rotY,
  r,
  isSeen,
  isActive,
  behavior,
}: {
  photo: Photo;
  rotX: number;
  rotY: number;
  r: number;
  isSeen: boolean;
  isActive: boolean;
  behavior: SeenBehavior;
}) {
  const [dustPhase, setDustPhase] = useState<'solid' | 'dusting' | 'gone'>(
    () => (behavior === 'dust' && isSeen ? 'gone' : 'solid'),
  );
  useEffect(() => {
    if (behavior !== 'dust') {
      // Behaviour just switched to ember — make sure dust state doesn't
      // linger and swallow subsequent renders.
      if (dustPhase !== 'solid') setDustPhase('solid');
      return;
    }
    if (!isSeen) {
      // Reset flow: parent cleared seen → snap back to solid so a
      // future re-mark can play the dust animation again.
      if (dustPhase !== 'solid') setDustPhase('solid');
      return;
    }
    if (dustPhase !== 'solid') return;
    setDustPhase('dusting');
    const t = setTimeout(() => setDustPhase('gone'), 1800);
    return () => clearTimeout(t);
  }, [isSeen, dustPhase, behavior]);

  const { x, y, z } = project(photo.phi, photo.theta, rotX, rotY);
  if (z < -0.05) return null;

  // Dust-mode terminal states
  if (behavior === 'dust') {
    if (dustPhase === 'gone') return null;
    if (dustPhase === 'dusting') {
      const cx = r + x * r * 0.94;
      const cy = r - y * r * 0.94;
      return <ThanosDust cx={cx} cy={cy} z={z} hue={CONTENT_HUE_UNSEEN} />;
    }
  }

  const isViewed = behavior === 'ember' && isSeen;
  const hue = isViewed ? CONTENT_HUE_VIEWED : CONTENT_HUE_UNSEEN;
  const depth = (z + 1) / 2;
  const base = 10 * (0.55 + depth * 0.85);
  const size = isActive ? base * 1.55 : base;
  const color = `hsl(${hue}, 88%, 60%)`;
  const cx = r + x * r * 0.94;
  const cy = r - y * r * 0.94;
  return (
    <div
      className="absolute pointer-events-none"
      style={{
        width: size,
        height: size,
        left: cx - size / 2,
        top: cy - size / 2,
        transform: `rotate(${((photo.id * 47) % 90) - 45}deg)`,
        backgroundImage: `radial-gradient(circle at 30% 30%, hsl(${hue}, 95%, 75%), hsl(${hue}, 80%, 45%))`,
        borderRadius: 2,
        boxShadow: isActive
          ? `0 0 14px ${color}, 0 0 26px hsla(${hue}, 80%, 55%, 0.6)`
          : `0 0 7px hsla(${hue}, 85%, 55%, 0.75)`,
        // Snappier transitions overall. The colour change (green→amber)
        // is the primary feedback the user is waiting on, so it's the
        // shortest.
        transition: 'width 180ms ease-out, height 180ms ease-out, background-image 160ms ease-out, box-shadow 180ms ease-out',
        zIndex: Math.round((z + 1) * 200) + 50,
      }}
    />
  );
}

// Thanos-snap dust burst — ~22 particles in the shared green palette
// drift outward from (cx, cy), blur, and fade over ~1.5s. Particle field
// is seeded from the burst origin so it stays visually stable across
// React re-renders that happen mid-animation (e.g. the ball rotating).
function ThanosDust({
  cx,
  cy,
  z,
  hue,
}: {
  cx: number;
  cy: number;
  z: number;
  hue: number;
}) {
  const particles = useMemo(() => {
    const arr: {
      angle: number;
      distance: number;
      duration: number;
      delay: number;
      size: number;
    }[] = [];
    const n = 22;
    const seedBase = Math.floor(cx * 13 + cy * 7);
    for (let i = 0; i < n; i++) {
      const s = (i + 1) * 733 + seedBase;
      const jitter = ((s % 100) / 100 - 0.5) * 0.7;
      arr.push({
        angle: (i / n) * Math.PI * 2 + jitter,
        distance: 14 + (((s * 3) % 100) / 100) * 26,
        duration: 900 + (((s * 5) % 100) / 100) * 700,
        delay: (((s * 7) % 100) / 100) * 220,
        size: 1.1 + (((s * 11) % 100) / 100) * 2.4,
      });
    }
    return arr;
    // Deliberately no deps — particles must be fixed for the duration of
    // the burst. Downstream re-renders (ball rotation) reposition the
    // origin but should not reshuffle the swarm.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Two-frame trick: paint the initial state first, then flip to the
  // final state so the CSS transition actually runs (otherwise the
  // browser may collapse the two states and skip straight to the end).
  const [started, setStarted] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setStarted(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <>
      {particles.map((p, i) => {
        const dx = Math.cos(p.angle) * p.distance;
        const dy = Math.sin(p.angle) * p.distance - 22; // upward bias
        return (
          <div
            key={i}
            className="absolute rounded-full pointer-events-none"
            style={{
              width: p.size,
              height: p.size,
              left: cx - p.size / 2,
              top: cy - p.size / 2,
              backgroundColor: `hsl(${hue}, 78%, 62%)`,
              opacity: started ? 0 : 0.92,
              transform: started
                ? `translate(${dx}px, ${dy}px) scale(0.32)`
                : 'translate(0, 0) scale(1)',
              transition: `transform ${p.duration}ms cubic-bezier(0.22, 0.65, 0.3, 1) ${p.delay}ms, opacity ${p.duration}ms ease-out ${p.delay}ms`,
              filter: started ? 'blur(1.4px)' : 'none',
              zIndex: Math.round((z + 1) * 200) + 100,
            }}
          />
        );
      })}
    </>
  );
}

function DiscoBall({
  photos,
  rotX,
  rotY,
  seen,
  activeId,
  size = 320,
  behavior,
}: {
  photos: Photo[];
  rotX: number;
  rotY: number;
  seen: Set<number>;
  // Null when no task is currently the viewfinder subject — e.g. dust
  // mode after every task has snapped away.
  activeId: number | null;
  size?: number;
  behavior: SeenBehavior;
}) {
  const r = size / 2;
  return (
    <div
      className="relative rounded-full overflow-hidden"
      style={{
        width: size,
        height: size,
        // Base is intentionally silvery-with-a-hint-of-shadow so any tiny
        // seam between overlapping flakes reads as a mirror crease, not a
        // hole in the surface.
        backgroundImage: [
          'radial-gradient(circle at 32% 24%, rgba(255,255,255,0.7), rgba(255,255,255,0) 32%)',
          'radial-gradient(circle at 62% 78%, rgba(255,255,255,0.10), rgba(255,255,255,0) 45%)',
          'radial-gradient(circle at 50% 50%, #a8b0bb 0%, #7f8895 30%, #4d5665 62%, #2a303a 88%, #14181e 100%)',
        ].join(', '),
        boxShadow: [
          'inset -12px -20px 36px rgba(0,0,0,0.55)',
          'inset 10px 14px 26px rgba(255,255,255,0.28)',
          '0 12px 30px rgba(0,0,0,0.55)',
        ].join(', '),
      }}
      aria-label="Discoverable content — silver disco sphere"
    >
      {SILVER_FLAKES.map((flake, i) => (
        <SilverFlake key={i} flake={flake} rotX={rotX} rotY={rotY} r={r} />
      ))}
      {photos.map((p) => (
        <ContentMarker
          key={p.id}
          photo={p}
          rotX={rotX}
          rotY={rotY}
          r={r}
          isSeen={seen.has(p.id)}
          isActive={p.id === activeId}
          behavior={behavior}
        />
      ))}
      {/* Ambient highlight streaks — sell the sphere read even between
          the specular hotspot and the flakes. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-full"
        style={{
          backgroundImage: [
            'radial-gradient(ellipse 90% 5% at 50% 44%, rgba(255,255,255,0.16), transparent 70%)',
            'radial-gradient(ellipse 5% 60% at 34% 40%, rgba(255,255,255,0.2), transparent 72%)',
          ].join(', '),
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

function EmptyCameraView({
  width = 300,
  aspect = '9 / 16',
  onReset,
}: {
  width?: number;
  aspect?: string;
  onReset: () => void;
}) {
  return (
    <div
      className="relative rounded-2xl overflow-hidden border border-charcoal/40 bg-black shadow-2xl flex items-center justify-center"
      style={{ width, aspectRatio: aspect }}
      aria-live="polite"
      aria-label="Nothing left to discover"
    >
      <div className="flex flex-col items-center gap-3 px-6 text-center">
        <div className="font-display text-3xl text-charcoal-soft">
          Nothing left
        </div>
        <div className="text-[10px] font-display uppercase tracking-wider text-charcoal-soft">
          You've cleared the map
        </div>
        <button
          type="button"
          onClick={onReset}
          className="mt-2 text-[11px] font-display uppercase tracking-wider text-charcoal hover:text-glove underline underline-offset-2"
        >
          Reset
        </button>
      </div>
      <div className="absolute inset-2 rounded-xl border border-white/10 pointer-events-none" />
    </div>
  );
}

function ViewfinderVariant({
  state,
  behavior,
}: {
  state: DiscoState;
  behavior: SeenBehavior;
}) {
  const { photos, rotX, rotY, rotate, seen, activePhoto, reset } = state;
  return (
    <div className="flex flex-col items-center gap-6">
      <ProgressChip state={state} />
      {/* Camera and disco sphere sit side-by-side — the ball never
          occludes the shot; they read as two instruments on one panel. */}
      <div className="flex items-start justify-center gap-8 flex-wrap">
        {activePhoto ? (
          <CameraView photo={activePhoto} width={300} />
        ) : (
          <EmptyCameraView width={300} onReset={reset} />
        )}
        <div className="flex flex-col items-center gap-2 pt-2">
          <DiscoBall
            photos={photos}
            rotX={rotX}
            rotY={rotY}
            seen={seen}
            activeId={activePhoto?.id ?? null}
            size={220}
            behavior={behavior}
          />
          <span className="text-[10px] font-display uppercase tracking-wider text-charcoal-soft">
            Map
          </span>
        </div>
      </div>
      {/* Trackball sits below and is smaller than the disco sphere — a
          modest controller under a substantial "map". */}
      <Trackball onRotate={rotate} size={120} />
      <p className="text-xs text-charcoal-soft max-w-md text-center">
        Camera holds the stage. Roll the trackball to spin the mirrored
        sphere — each green facet is a task; land it in the viewfinder
        and it {behavior === 'dust' ? 'snaps to dust' : 'ambers over to mark it viewed'}.
      </p>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Shell — one layout (Viewfinder), two behaviours for what
// happens when a task is "seen": dust away, or turn amber.
// ────────────────────────────────────────────────────────────

const BEHAVIOR_TABS: { key: SeenBehavior; label: string; caption: string }[] = [
  {
    key: 'dust',
    label: 'Snap away',
    caption: 'Seen tasks disintegrate like the Endgame snap.',
  },
  {
    key: 'ember',
    label: 'Turn amber',
    caption: 'Seen tasks amber over and stay — a trail of what you\'ve looked at.',
  },
];

function isBehaviorKey(v: string): v is SeenBehavior {
  return v === 'dust' || v === 'ember';
}

export function DiscoverPOC() {
  // The body of this POC is all inline-styled with computed floats, gradient
  // shorthands, and hsl()/hex colours — every one of those normalizes
  // differently in the DOM vs. what React emits, so SSR'd markup can't hydrate
  // cleanly against it. Since none of it is meaningful until interaction
  // starts anyway, gate the render on mount.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [behavior, setBehavior] = useState<SeenBehavior>('dust');
  const state = useDiscoState(24, behavior);

  // Deep-link the behaviour via /discover#dust or #ember.
  useEffect(() => {
    if (!mounted) return;
    const apply = () => {
      const h = window.location.hash.replace(/^#/, '');
      if (isBehaviorKey(h)) setBehavior(h);
    };
    apply();
    window.addEventListener('hashchange', apply);
    return () => window.removeEventListener('hashchange', apply);
  }, [mounted]);

  const pick = (b: SeenBehavior) => {
    setBehavior(b);
    state.reset();
    if (typeof window !== 'undefined') {
      history.replaceState(null, '', `#${b}`);
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

  const caption = BEHAVIOR_TABS.find((b) => b.key === behavior)?.caption ?? '';

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex flex-col items-center gap-1">
        <div className="flex gap-2 flex-wrap justify-center">
          {BEHAVIOR_TABS.map((b) => (
            <Button
              key={b.key}
              size="sm"
              variant={behavior === b.key ? 'primary' : 'ghost'}
              onClick={() => pick(b.key)}
            >
              {b.label}
            </Button>
          ))}
        </div>
        <p className="text-[11px] text-charcoal-soft">{caption}</p>
      </div>
      <div className="w-full pt-2">
        <ViewfinderVariant state={state} behavior={behavior} />
      </div>
    </div>
  );
}
