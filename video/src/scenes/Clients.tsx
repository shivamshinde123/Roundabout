import React from "react";
import { AbsoluteFill } from "remotion";
import { enter, pop, pulse, useSeconds } from "../anim";
import { Scene, wordAt } from "../components/Scene";
import { Avatar, CLIENT_NAMES, H, Kicker } from "../components/ui";
import { T } from "../theme";

const KIND: Record<string, string> = {
  claude_code: "Command line", codex: "Command line", cursor: "Editor", windsurf: "Editor", gemini_cli: "Command line",
  copilot: "VS Code", cline: "VS Code", opencode: "Command line", zed: "Editor", warp: "Terminal", jetbrains: "IDE",
  claude_ai: "Hosted · OAuth", claude_duet: "Hosted · OAuth", chatgpt: "Hosted · OAuth", dots: "Hosted · OAuth",
  gemini_app: "Hosted · OAuth", grok: "Hosted · OAuth", grok_bot: "Hosted · OAuth", muse: "Token", instinct: "Token", other: "URL + token",
};
const ORDER = Object.keys(KIND);
/** Which spoken word lights up which tiles. */
const SPOKEN: Record<string, string[]> = {
  Claude: ["claude_code"], Codex: ["codex"], Cursor: ["cursor"], Gemini: ["gemini_cli", "gemini_app"], Copilot: ["copilot"], ChatGPT: ["chatgpt"],
};

export const Clients: React.FC = () => {
  const t = useSeconds();
  const glowOf = (c: string) => {
    let g = 0;
    for (const [w, cs] of Object.entries(SPOKEN)) if (cs.includes(c)) g = Math.max(g, pulse(t, wordAt("clients", w), 1.3));
    return g;
  };
  const dozen = wordAt("clients", "dozen");
  return (
    <Scene vo="clients">
      <AbsoluteFill style={{ padding: "84px 100px 0" }}>
        <div style={enter(t, 0.2)}>
          <Kicker>Works with your agents</Kicker>
        </div>
        <H size={76} style={{ marginTop: 18, ...enter(t, 0.4) }}>
          Bring the agents you already use.
        </H>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 18, marginTop: 64 }}>
          {ORDER.map((c, i) => {
            const g = glowOf(c);
            const row = Math.floor(i / 7);
            const col = i % 7;
            return (
              <div
                key={c}
                style={{
                  display: "flex", alignItems: "center", gap: 12, padding: "24px 14px", borderRadius: 14, background: g > 0.05 ? "rgba(94,106,210,.12)" : T.panel,
                  border: `1px solid ${g > 0.05 ? T.indigoSoft : T.line}`, boxShadow: `0 0 ${40 * g}px rgba(94,106,210,.5)`,
                  ...enter(t, 0.7 + (row + col) * 0.07, 0.6, 26), scale: `${1 + g * 0.06}`,
                }}
              >
                <Avatar client={c} size={48} />
                <div style={{ display: "grid", gap: 2, minWidth: 0 }}>
                  <span style={{ fontSize: 20, color: T.text, fontWeight: 600, whiteSpace: "nowrap" }}>{CLIENT_NAMES[c]}</span>
                  <span style={{ fontSize: 17, color: T.muted, whiteSpace: "nowrap" }}>{KIND[c]}</span>
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: 18, marginTop: 50, justifyContent: "center" }}>
          {["20+ clients with step-by-step setup", "Bearer token for CLIs and editors", "OAuth 2.1 for hosted apps"].map((x, i) => (
            <span key={x} style={{ ...pop(t, dozen - 0.2 + i * 0.25), fontSize: 25, color: T.text, background: T.panel, border: `1px solid ${T.lineStrong}`, borderRadius: 99, padding: "10px 24px" }}>
              {x}
            </span>
          ))}
        </div>
      </AbsoluteFill>
    </Scene>
  );
};
