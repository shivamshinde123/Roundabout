import { Audio } from "@remotion/media";
import React from "react";
import { AbsoluteFill, Sequence, staticFile, useVideoConfig } from "remotion";
import voiceover from "../voiceover.json";
import { BACKDROP, T } from "../theme";
import { Captions } from "./Captions";

export const VO_DELAY_S = 0.6;

/** One scene: its background and visuals, plus its voiceover line and captions. */
export const Scene: React.FC<{ vo: string; background?: string; children: React.ReactNode }> = ({ vo, background = BACKDROP, children }) => {
  const { fps } = useVideoConfig();
  const line = voiceover.find((v) => v.id === vo)!;
  return (
    <AbsoluteFill style={{ background, fontFamily: T.ui, color: T.text, overflow: "hidden" }}>
      {children}
      <Sequence name={`Voiceover · ${vo}`} from={Math.round(VO_DELAY_S * fps)} layout="none">
        <Audio src={staticFile(`voiceover/${vo}.mp3`)} />
        <Captions words={line.words} text={line.text} />
      </Sequence>
    </AbsoluteFill>
  );
};

/** Seconds into the scene at which a given word is spoken (for syncing visuals to the narration). */
export const wordAt = (vo: string, word: string, nth = 0): number => {
  const line = voiceover.find((v) => v.id === vo)!;
  const clean = (s: string) => s.replace(/[^\w']/g, "").toLowerCase();
  const exact = line.words.filter((w) => clean(w.text) === clean(word));
  const hits = exact.length ? exact : line.words.filter((w) => clean(w.text).startsWith(clean(word)));
  const w = hits[nth] ?? hits[0];
  return VO_DELAY_S + (w ? w.startMs / 1000 : 0);
};

/** Seconds into the scene at which the narration ends. */
export const voEnd = (vo: string) => VO_DELAY_S + voiceover.find((v) => v.id === vo)!.durationMs / 1000;
