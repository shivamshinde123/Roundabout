import { Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";

export const EASE = Easing.bezier(0.16, 1, 0.3, 1);
export const SPRING = Easing.spring({ damping: 14, mass: 0.8 });
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** Current time in seconds within the scene. */
export const useSeconds = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return frame / fps;
};

/** 0→1 progress between two times (seconds), eased. */
export const prog = (t: number, start: number, dur = 0.7, easing = EASE) =>
  interpolate(t, [start, start + dur], [0, 1], { ...clamp, easing });

/** Fade + rise in at `start`. */
export const enter = (t: number, start: number, dur = 0.8, rise = 28) => {
  const p = prog(t, start, dur);
  return { opacity: p, translate: `0 ${(1 - p) * rise}px` } as const;
};

/** Pop in with a little overshoot at `start`. */
export const pop = (t: number, start: number, dur = 0.55) => {
  const p = prog(t, start, dur, SPRING);
  return { opacity: Math.min(1, p * 1.6), scale: `${0.6 + 0.4 * p}` } as const;
};

/** A soft pulse (0→1→0) centred on `at`, for highlighting the thing being named. */
export const pulse = (t: number, at: number, width = 0.9) =>
  interpolate(t, [at - 0.15, at + 0.1, at + width], [0, 1, 0], clamp);

export const lerp = (a: number, b: number, p: number) => a + (b - a) * p;

/** Deterministic pseudo-random in [0,1). */
export const rand = (seed: number) => {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
};

/** Characters of `text` revealed by typing from `start` at `cps` characters per second. */
export const typed = (t: number, start: number, text: string, cps = 38) =>
  text.slice(0, Math.max(0, Math.floor((t - start) * cps)));
