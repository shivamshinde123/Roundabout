import React from "react";
import { AbsoluteFill } from "remotion";
import { enter, prog, typed, useSeconds } from "../anim";
import { Scene, wordAt } from "../components/Scene";
import { Avatar, CLIENT_NAMES } from "../components/ui";
import { T } from "../theme";

const SESSIONS = [
  { client: "claude_code", word: "Claude", x: 110, y: 110, rot: -3, lines: ["› Fixing the login redirect", "  Reading src/auth/session.ts", "  Editing 3 files…"] },
  { client: "codex", word: "Codex", x: 660, y: 480, rot: 1.5, lines: ["› Writing checkout tests", "  12 passing, 2 failing", "  Investigating cart.test.ts…"] },
  { client: "cursor", word: "Cursor", x: 1210, y: 170, rot: 3, lines: ["› Migrating to API v2", "  Updating 14 endpoints", "  Waiting on a schema…"] },
];

/** Three agents busy in three windows, then: who's doing what? */
export const Hook: React.FC = () => {
  const t = useSeconds();
  const ask = wordAt("hook", "who's");
  const dim = prog(t, ask - 0.2, 0.8);
  return (
    <Scene vo="hook">
      <AbsoluteFill style={{ filter: `blur(${dim * 7}px)`, opacity: 1 - dim * 0.55, scale: `${1 - dim * 0.04}` }}>
        {SESSIONS.map((s, i) => {
          const start = Math.max(0.2, wordAt("hook", s.word) - 0.5);
          const drift = Math.sin(t * 0.6 + i * 2) * 8;
          return (
            <div
              key={s.client}
              style={{
                position: "absolute", left: s.x, top: s.y + drift, width: 600, rotate: `${s.rot}deg`,
                background: T.card, border: `1px solid ${T.line}`, borderRadius: 18, overflow: "hidden",
                boxShadow: "0 40px 100px -20px rgba(0,0,0,.8)", ...enter(t, start, 0.8, 50),
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 20px", borderBottom: `1px solid ${T.line}`, fontSize: 25, color: T.text, fontWeight: 600 }}>
                <Avatar client={s.client} size={38} />
                {CLIENT_NAMES[s.client]}
                <span style={{ marginLeft: "auto", width: 10, height: 10, borderRadius: 99, background: T.green, boxShadow: `0 0 10px ${T.green}`, opacity: 0.5 + 0.5 * Math.abs(Math.sin(t * 3 + i)) }} />
              </div>
              <div style={{ padding: "16px 20px", fontFamily: T.mono, fontSize: 24, lineHeight: 1.75, color: "#cfcfd6", minHeight: 170, whiteSpace: "pre" }}>
                {s.lines.map((l, j) => (
                  <div key={j} style={{ color: j === 0 ? T.text : T.muted }}>
                    {typed(t, start + 0.4 + j * 0.55, l, 42)}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </AbsoluteFill>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", paddingBottom: 90 }}>
        <div style={{ textAlign: "center", ...enter(t, ask, 0.7, 30) }}>
          <div style={{ fontSize: 140, fontWeight: 700, letterSpacing: "-0.04em", color: T.white, lineHeight: 1 }}>
            Who&apos;s doing <span style={{ color: T.indigoSoft }}>what?</span>
          </div>
        </div>
      </AbsoluteFill>
    </Scene>
  );
};
