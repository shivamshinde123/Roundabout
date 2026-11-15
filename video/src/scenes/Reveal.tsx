import React from "react";
import { AbsoluteFill } from "remotion";
import { enter, prog, useSeconds } from "../anim";
import { Scene, wordAt } from "../components/Scene";
import { Avatar, Mark } from "../components/ui";
import { GLOW, T } from "../theme";

const ORBITERS = ["claude_code", "codex", "cursor", "gemini_cli", "copilot", "chatgpt", "windsurf", "cline"];

/** The mark draws itself while agents circle it: a roundabout. */
export const Reveal: React.FC = () => {
  const t = useSeconds();
  const name = wordAt("reveal", "Roundabout");
  const tag = wordAt("reveal", "One");
  const draw = prog(t, 0.2, 1.4);
  const lift = prog(t, name - 0.1, 0.9);
  return (
    <Scene vo="reveal" background={T.shell}>
      <AbsoluteFill style={{ background: GLOW, opacity: prog(t, 0, 1.5) }} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", paddingBottom: 140 }}>
        <div style={{ position: "relative", width: 760, height: 760, translate: `0 ${-lift * 150}px`, scale: `${1 - lift * 0.3}` }}>
          {/* Orbit track */}
          <svg width={760} height={760} style={{ position: "absolute", inset: 0, opacity: prog(t, 0.6, 1) * 0.7 }}>
            <ellipse cx={380} cy={380} rx={330} ry={330} fill="none" stroke={T.line} strokeWidth={2} strokeDasharray="6 10" />
          </svg>
          {ORBITERS.map((c, i) => {
            const angle = (i / ORBITERS.length) * Math.PI * 2 + t * 0.35;
            const appear = prog(t, 0.8 + i * 0.12, 0.6);
            return (
              <div
                key={c}
                style={{
                  position: "absolute", left: 380 + Math.cos(angle) * 330 - 36, top: 380 + Math.sin(angle) * 330 - 36,
                  opacity: appear, scale: `${0.5 + appear * 0.5}`,
                }}
              >
                <Avatar client={c} size={72} />
              </div>
            );
          })}
          <div style={{ position: "absolute", left: 380 - 130, top: 380 - 130, scale: `${0.7 + 0.3 * prog(t, 0, 1.2)}` }}>
            <Mark size={260} draw={draw} orbit={t * 70} />
          </div>
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "flex-end", paddingBottom: 215 }}>
        <div style={{ fontSize: 150, fontWeight: 700, letterSpacing: "-0.045em", color: T.white, lineHeight: 1, ...enter(t, name, 0.9, 40) }}>Roundabout</div>
        <div style={{ marginTop: 22, fontSize: 46, color: T.soft, ...enter(t, tag, 0.8, 24) }}>
          One Kanban board for all your <span style={{ color: T.indigoSoft }}>AI agents</span>.
        </div>
      </AbsoluteFill>
    </Scene>
  );
};
