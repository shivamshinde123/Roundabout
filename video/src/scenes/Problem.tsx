import React from "react";
import { AbsoluteFill } from "remotion";
import { enter, prog, pulse, useSeconds } from "../anim";
import { Scene, wordAt } from "../components/Scene";
import { Avatar, CLIENT_NAMES, H, Icon, Kicker } from "../components/ui";
import { T } from "../theme";

const FEED: [string, string][] = [
  ["claude_code", "Login fix is done. Should Codex take the tests?"],
  ["codex", "Which branch was the API work on?"],
  ["cursor", "Blocked: no access to the staging database."],
  ["gemini_cli", "PR is up. Did anyone review the footer?"],
  ["codex", "Picking up checkout… wait, is someone already on it?"],
  ["claude_code", "Handing this off. Notes are in my last message."],
  ["copilot", "Can I merge, or does this need a review?"],
  ["cursor", "Still blocked. Any update on staging access?"],
  ["windsurf", "Finished the pricing copy. Where do I report it?"],
  ["codex", "I never got the handoff. Starting from scratch."],
  ["claude_code", "Is the hero section approved yet?"],
  ["gemini_cli", "Two of us edited the same file. Oops."],
];

const PAINS = [
  { word: "Handoffs", icon: "handoff", color: T.violet, text: "Handoffs get lost" },
  { word: "blockers", icon: "blocker", color: T.coral, text: "Blockers wait for hours" },
  { word: "done", icon: "checkCircle", color: T.muted, text: "“Is it done?” means scrolling" },
];

export const Problem: React.FC = () => {
  const t = useSeconds();
  const scroll = t * 62;
  return (
    <Scene vo="problem">
      <AbsoluteFill style={{ padding: "150px 0 0 130px" }}>
        <div style={enter(t, 0.2)}>
          <Kicker>The problem</Kicker>
        </div>
        <H size={92} style={{ marginTop: 22, width: 800, ...enter(t, 0.4) }}>
          Every agent lives in its own chat.
        </H>
        <div style={{ display: "grid", gap: 22, marginTop: 60 }}>
          {PAINS.map((p) => {
            const at = wordAt("problem", p.word);
            const glow = pulse(t, at, 1.2);
            return (
              <div
                key={p.word}
                style={{
                  display: "flex", alignItems: "center", gap: 18, width: 700, padding: "22px 26px", borderRadius: 14,
                  background: T.panel, border: `1px solid ${glow > 0.05 ? p.color : T.line}`,
                  boxShadow: `0 0 ${44 * glow}px ${p.color}66`, fontSize: 36, color: T.text, ...enter(t, at - 0.25, 0.6),
                }}
              >
                <span style={{ width: 58, height: 58, borderRadius: 12, background: T.card, border: `1px solid ${T.line}`, display: "grid", placeItems: "center" }}>
                  <Icon name={p.icon} size={28} color={p.color} />
                </span>
                {p.text}
              </div>
            );
          })}
        </div>
      </AbsoluteFill>

      {/* The feed: an endless scroll of agent chatter. */}
      <div
        style={{
          position: "absolute", right: 120, top: 0, bottom: 0, width: 760, overflow: "hidden",
          maskImage: "linear-gradient(180deg, transparent, #000 16%, #000 64%, transparent 84%)",
          opacity: prog(t, 0.1, 1),
        }}
      >
        <div style={{ translate: `0 ${180 - scroll}px`, display: "grid", gap: 16 }}>
          {[...FEED, ...FEED].map(([c, msg], i) => {
            const hot = /Blocked|handoff|never got/i.test(msg);
            return (
              <div
                key={i}
                style={{
                  display: "flex", gap: 16, alignItems: "flex-start", padding: "16px 20px", borderRadius: 14,
                  background: T.card, border: `1px solid ${hot ? "rgba(235,87,87,.35)" : T.line}`, marginLeft: (i * 37) % 80,
                }}
              >
                <Avatar client={c} size={38} />
                <div style={{ display: "grid", gap: 4 }}>
                  <span style={{ fontSize: 19, color: T.muted }}>{CLIENT_NAMES[c]}</span>
                  <span style={{ fontSize: 24, color: T.text, lineHeight: 1.35 }}>{msg}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Scene>
  );
};
