import { Audio } from "@remotion/media";
import { linearTiming, TransitionSeries } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import React from "react";
import { AbsoluteFill, interpolate, staticFile, useVideoConfig } from "remotion";
import { VO_DELAY_S } from "./components/Scene";
import { Board } from "./scenes/Board";
import { Clients } from "./scenes/Clients";
import { Connect } from "./scenes/Connect";
import { Cta } from "./scenes/Cta";
import { Handoff } from "./scenes/Handoff";
import { Hook } from "./scenes/Hook";
import { Pickup } from "./scenes/Pickup";
import { Problem } from "./scenes/Problem";
import { Reveal } from "./scenes/Reveal";
import { Review } from "./scenes/Review";
import { Trust } from "./scenes/Trust";
import { Updates } from "./scenes/Updates";
import { T } from "./theme";
import voiceover from "./voiceover.json";

// Scene lengths in seconds, in order. Each scene's voiceover starts VO_DELAY_S in. Total ≈ 2:30.
export const SCENES = [
  { id: "hook", seconds: 11 },
  { id: "problem", seconds: 12.5 },
  { id: "reveal", seconds: 10 },
  { id: "board", seconds: 14 },
  { id: "connect", seconds: 14 },
  { id: "pickup", seconds: 14 },
  { id: "handoff", seconds: 13 },
  { id: "review", seconds: 13 },
  { id: "updates", seconds: 14 },
  { id: "clients", seconds: 13.5 },
  { id: "trust", seconds: 14.5 },
  { id: "cta", seconds: 13 },
] as const;
export const FPS = 30;
export const TRANSITION_FRAMES = 18;
export const TOTAL_FRAMES = SCENES.reduce((n, s) => n + Math.round(s.seconds * FPS), 0) - (SCENES.length - 1) * TRANSITION_FRAMES;

/** Global time ranges (in frames) where the narrator is speaking, used to duck the music. */
const SPEECH: [number, number][] = (() => {
  const out: [number, number][] = [];
  let start = 0;
  for (const s of SCENES) {
    const line = voiceover.find((v) => v.id === s.id)!;
    const a = start + Math.round(VO_DELAY_S * FPS);
    out.push([a, a + Math.round((line.durationMs / 1000) * FPS)]);
    start += Math.round(s.seconds * FPS) - TRANSITION_FRAMES;
  }
  return out;
})();

const musicVolume = (f: number) => {
  const edge = interpolate(f, [0, 45, TOTAL_FRAMES - 90, TOTAL_FRAMES], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  let duck = 1;
  for (const [a, b] of SPEECH) {
    const d = interpolate(f, [a - 12, a, b, b + 18], [1, 0.4, 0.4, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    duck = Math.min(duck, d);
  }
  return 0.32 * edge * duck;
};

const SCENE_COMPONENTS: Record<(typeof SCENES)[number]["id"], React.FC> = {
  hook: Hook,
  problem: Problem,
  reveal: Reveal,
  board: Board,
  connect: Connect,
  pickup: Pickup,
  handoff: Handoff,
  review: Review,
  updates: Updates,
  clients: Clients,
  trust: Trust,
  cta: () => <Cta seconds={SCENES[SCENES.length - 1].seconds} />,
};

export const Promo: React.FC = () => {
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill style={{ background: T.shell }}>
      <TransitionSeries>
        {SCENES.flatMap((s, i) => {
          const Comp = SCENE_COMPONENTS[s.id];
          const seq = (
            <TransitionSeries.Sequence key={s.id} name={s.id} durationInFrames={Math.round(s.seconds * fps)}>
              <Comp />
            </TransitionSeries.Sequence>
          );
          return i === 0
            ? [seq]
            : [<TransitionSeries.Transition key={`t-${s.id}`} presentation={fade()} timing={linearTiming({ durationInFrames: TRANSITION_FRAMES })} />, seq];
        })}
      </TransitionSeries>
      <Audio src={staticFile("music/bed.wav")} volume={musicVolume} name="Music" />
    </AbsoluteFill>
  );
};
