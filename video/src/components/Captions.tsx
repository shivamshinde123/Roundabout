import React from "react";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { T } from "../theme";

export type Word = { text: string; startMs: number; endMs: number };

/**
 * Groups words into caption lines at the script's punctuation (so lines read as phrases),
 * splitting long phrases evenly so no line has more than 8 words or ends on a single word.
 * `text` is the spoken line; its whitespace tokens line up 1:1 with `words`.
 */
function chunk(words: Word[], text: string): Word[][] {
  const tokens = text.split(/\s+/);
  const phrases: Word[][] = [];
  let cur: Word[] = [];
  words.forEach((w, i) => {
    cur.push(w);
    if (/[.,:;?!…]$/.test(tokens[i] ?? "") || i === words.length - 1) {
      phrases.push(cur);
      cur = [];
    }
  });
  const out: Word[][] = [];
  for (const p of phrases) {
    const parts = Math.ceil(p.length / 8);
    const size = Math.ceil(p.length / parts);
    for (let i = 0; i < p.length; i += size) out.push(p.slice(i, i + size));
  }
  for (let i = out.length - 1; i >= 0; i--) {
    if (out[i].length !== 1 || out.length === 1) continue;
    if (i + 1 < out.length && out[i + 1].length < 9) {
      out[i + 1] = out[i].concat(out[i + 1]);
      out.splice(i, 1);
    } else if (i > 0 && out[i - 1].length < 9) {
      out[i - 1] = out[i - 1].concat(out[i]);
      out.splice(i, 1);
    }
  }
  return out;
}

/** Word-by-word captions. Frame 0 = the moment the voiceover starts. */
export const Captions: React.FC<{ words: Word[]; text: string }> = ({ words, text }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const ms = (frame / fps) * 1000;
  const lines = chunk(words, text);
  const idx = lines.findIndex((line, i) => {
    const next = lines[i + 1];
    const end = next ? next[0].startMs - 60 : line[line.length - 1].endMs + 700;
    return ms >= line[0].startMs - 120 && ms < end;
  });
  if (idx < 0) return null;
  const line = lines[idx];
  const appear = interpolate(ms, [line[0].startMs - 120, line[0].startMs + 60], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 60, display: "flex", justifyContent: "center", pointerEvents: "none" }}>
      <div
        style={{
          maxWidth: 1500,
          padding: "12px 28px 14px",
          borderRadius: 16,
          background: "rgba(15,15,17,.78)",
          boxShadow: `inset 0 0 0 1px ${T.line}, 0 10px 40px rgba(0,0,0,.4)`,
          font: `500 44px/1.3 ${T.ui}`,
          letterSpacing: "-0.01em",
          textAlign: "center",
          opacity: appear,
          translate: `0 ${(1 - appear) * 10}px`,
        }}
      >
        {line.map((w, i) => {
          const active = ms >= w.startMs && ms < w.endMs + 80;
          const past = ms >= w.endMs + 80;
          return (
            <span
              key={i}
              style={{
                color: active ? T.white : past ? T.text : "rgba(230,230,232,.4)",
                textShadow: active ? "0 0 22px rgba(165,173,240,.55)" : "none",
                margin: "0 .13em",
              }}
            >
              {w.text}
            </span>
          );
        })}
      </div>
    </div>
  );
};
