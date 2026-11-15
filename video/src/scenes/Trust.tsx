import React from "react";
import { AbsoluteFill } from "remotion";
import { enter, pop, prog, pulse, useSeconds } from "../anim";
import { Scene, wordAt } from "../components/Scene";
import { Avatar, H, Icon, Kicker } from "../components/ui";
import { T } from "../theme";

const Box: React.FC<{ icon: string; title: string; sub: string; glow: number; color?: string; style: React.CSSProperties }> = ({ icon, title, sub, glow, color = T.indigoSoft, style }) => (
  <div
    style={{
      position: "absolute", display: "flex", alignItems: "center", gap: 20, padding: "24px 26px", borderRadius: 16, background: T.panel,
      border: `1px solid ${glow > 0.05 ? color : T.line}`, boxShadow: `0 24px 60px -20px rgba(0,0,0,.8), 0 0 ${50 * glow}px ${color}66`, ...style,
    }}
  >
    <span style={{ width: 64, height: 64, borderRadius: 14, background: T.card, border: `1px solid ${T.line}`, display: "grid", placeItems: "center", flex: "none" }}>
      <Icon name={icon} size={32} color={color} />
    </span>
    <div style={{ display: "grid", gap: 4 }}>
      <span style={{ fontSize: 30, color: T.white, fontWeight: 600 }}>{title}</span>
      <span style={{ fontSize: 21, color: T.muted }}>{sub}</span>
    </div>
  </div>
);

export const Trust: React.FC = () => {
  const t = useSeconds();
  const app = wordAt("trust", "app");
  const rules = wordAt("trust", "rules");
  const tx = wordAt("trust", "transaction");
  const recorded = wordAt("trust", "recorded");
  const hashed = wordAt("trust", "hashed");
  const project = wordAt("trust", "project");
  const flow = (t * 0.9) % 1;

  return (
    <Scene vo="trust">
      <AbsoluteFill style={{ padding: "84px 120px 0" }}>
        <div style={enter(t, 0.2)}>
          <Kicker>Under the hood</Kicker>
        </div>
        <H size={76} style={{ marginTop: 18, ...enter(t, 0.4) }}>
          One app. One set of rules.
        </H>
      </AbsoluteFill>

      {/* Diagram */}
      <div style={{ position: "absolute", left: 120, top: 290, width: 1000, height: 560 }}>
        <svg width={1000} height={560} style={{ position: "absolute", inset: 0, opacity: prog(t, rules - 0.6, 0.8) }}>
          {[
            "M 230 114 L 230 166 L 500 166 L 500 218",
            "M 770 114 L 770 166 L 500 166 L 500 218",
            "M 500 334 L 500 408",
          ].map((d, i) => (
            <g key={i}>
              <path d={d} fill="none" stroke={T.lineStrong} strokeWidth={3} />
              <path d={d} fill="none" stroke={T.indigoSoft} strokeWidth={3} pathLength={100} strokeDasharray="10 90" strokeDashoffset={-((flow * 100 + i * 33) % 100)} />
            </g>
          ))}
        </svg>
        <Box icon="globe" title="Web app" sub="You · the board" glow={pulse(t, app, 1.2)} style={{ left: 30, top: 0, width: 400, ...enter(t, app - 0.4, 0.6) }} />
        <Box icon="plug" title="MCP endpoint" sub="Agents · /api/mcp" glow={pulse(t, app, 1.2)} style={{ left: 570, top: 0, width: 400, ...enter(t, app - 0.2, 0.6) }} />
        <Box icon="rules" title="Services + policy" sub="the same checks for people and agents" glow={pulse(t, rules, 1.6)} style={{ left: 170, top: 220, width: 660, ...enter(t, rules - 0.4, 0.6) }} />
        <Box icon="db" title="Postgres" sub="one transaction per change, plus an activity record" glow={pulse(t, tx, 1.8)} color={T.teal} style={{ left: 170, top: 410, width: 660, ...enter(t, tx - 0.4, 0.6) }} />
      </div>

      {/* Right: activity record and security facts */}
      <div style={{ position: "absolute", left: 1170, top: 290, width: 630, display: "grid", gap: 16 }}>
        <div style={{ background: T.panel, border: `1px solid ${T.line}`, borderRadius: 16, padding: "18px 22px", display: "grid", gap: 14, ...enter(t, recorded - 0.3, 0.6, 20) }}>
          <span style={{ fontSize: 20, color: T.muted }}>Activity</span>
          {[
            { c: "codex", text: "accepted “Add pricing page”", icon: "checkCircle", color: T.yellow },
            { c: "claude_code", text: "handed off to Codex", icon: "handoff", color: T.violet },
            { c: null, text: "approved the result", icon: "checkCircle", color: T.indigo },
          ].map((r, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 23, color: T.soft, ...enter(t, recorded + i * 0.3, 0.4, 10) }}>
              <Icon name={r.icon} size={22} color={r.color} />
              {r.c ? <Avatar client={r.c} size={28} /> : <span style={{ width: 28, height: 28, borderRadius: 99, background: T.indigo, color: "#fff", fontSize: 15, display: "grid", placeItems: "center", fontWeight: 600 }}>Y</span>}
              <b style={{ color: T.white, fontWeight: 600 }}>{r.c ? (r.c === "codex" ? "Codex" : "Claude Code") : "You"}</b> {r.text}
            </div>
          ))}
        </div>
        {[
          { at: hashed, icon: "lock", text: "Tokens stored only as SHA-256 hashes" },
          { at: project, icon: "shield", text: "Access granted per project" },
          { at: project + 0.5, icon: "rotate", text: "Safe retries: a request id replays, never repeats" },
          { at: project + 0.9, icon: "plug", text: "OAuth 2.1 with PKCE for hosted apps" },
        ].map((c) => (
          <div
            key={c.text}
            style={{
              display: "flex", alignItems: "center", gap: 14, padding: "17px 20px", borderRadius: 12, background: T.panel, fontSize: 23, color: T.text,
              border: `1px solid ${pulse(t, c.at, 1.2) > 0.05 ? T.indigoSoft : T.line}`, ...pop(t, c.at - 0.15),
            }}
          >
            <Icon name={c.icon} size={22} color={T.indigoSoft} /> {c.text}
          </div>
        ))}
      </div>
    </Scene>
  );
};
