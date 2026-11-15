import React from "react";
import { AbsoluteFill } from "remotion";
import { enter, pop, prog, pulse, typed, useSeconds } from "../anim";
import { Scene, wordAt } from "../components/Scene";
import { Avatar, H, Icon, Kicker, Terminal } from "../components/ui";
import { T } from "../theme";

const CMD = [
  "$ claude mcp add --scope user --transport http roundabout \\",
  "    https://roundabout-agents.vercel.app/api/mcp \\",
  '    --header "Authorization: Bearer rbt_7Kx2••••••••"',
];

export const Connect: React.FC = () => {
  const t = useSeconds();
  const mcp = wordAt("connect", "MCP");
  const paste = wordAt("connect", "Paste");
  const projects = wordAt("connect", "projects");
  const connected = wordAt("connect", "connected");
  const token = wordAt("connect", "token");

  // Type the three command lines one after another, starting as "Paste" is spoken.
  let start = paste - 0.2;
  const lines = CMD.map((l) => {
    const s = start;
    start += l.length / 70 + 0.08;
    return typed(t, s, l, 70);
  });
  const getLine = typed(t, connected - 0.9, "$ claude mcp get roundabout", 60);
  const ok = prog(t, connected - 0.15, 0.4);

  return (
    <Scene vo="connect">
      <AbsoluteFill style={{ padding: "84px 120px 0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18, ...enter(t, 0.2) }}>
          <Kicker>Connect an agent</Kicker>
          <span style={{ ...pop(t, mcp), fontSize: 22, color: T.text, background: T.panel, border: `1px solid ${T.lineStrong}`, borderRadius: 99, padding: "6px 16px" }}>
            MCP · Model Context Protocol
          </span>
        </div>
        <H size={76} style={{ marginTop: 18, ...enter(t, 0.4) }}>
          One command, and it&apos;s in.
        </H>

        <div style={{ display: "flex", gap: 40, marginTop: 46, alignItems: "flex-start" }}>
          <div style={{ display: "grid", gap: 24, width: 1010 }}>
          <Terminal
            title={
              <>
                <Avatar client="claude_code" size={30} /> Claude Code · terminal
              </>
            }
            style={enter(t, paste - 0.8, 0.7, 30)}
          >
            {lines.map((l, i) => (
              <div key={i} style={{ color: i === 0 ? T.text : "#cfcfd6", minHeight: 35 }}>{l}</div>
            ))}
            <div style={{ minHeight: 18 }} />
            <div style={{ color: T.text, minHeight: 35 }}>{getLine}</div>
            <div style={{ color: T.green, opacity: ok, minHeight: 35, textShadow: `0 0 ${18 * pulse(t, connected, 1.4)}px ${T.green}` }}>
              {"  Status: ✓ Connected"}
            </div>
          </Terminal>
          <Terminal
            title={
              <>
                <Avatar client="codex" size={30} /> Codex · the same in one line
              </>
            }
            style={enter(t, projects + 0.2, 0.7, 30)}
          >
            <div style={{ color: T.text }}>{typed(t, projects + 0.5, "$ codex mcp add roundabout --url …/api/mcp \\", 70)}</div>
            <div>{typed(t, projects + 1.2, "    --bearer-token-env-var ROUNDABOUT_TOKEN", 70)}</div>
          </Terminal>
          </div>

          <div
            style={{
              width: 630, background: T.panel, border: `1px solid ${T.line}`, borderRadius: 16, padding: 32, display: "grid", gap: 28,
              boxShadow: "0 30px 90px -20px rgba(0,0,0,.7)", ...enter(t, paste, 0.7, 30),
            }}
          >
            <div style={{ fontSize: 30, fontWeight: 600, color: T.white }}>Connect agent</div>
            <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 18px", borderRadius: 10, border: `1px solid ${T.indigo}`, background: "rgba(94,106,210,.1)", fontSize: 25 }}>
              <Avatar client="claude_code" size={34} /> Claude Code
              <Icon name="check" size={22} color={T.indigoSoft} style={{ marginLeft: "auto" }} />
            </div>
            <div style={{ display: "grid", gap: 16 }}>
              <div style={{ fontSize: 20, color: T.muted }}>Projects it may use</div>
              {["Website", "Mobile app", "Data pipeline"].map((p, i) => {
                const on = i < 2 && t > projects - 0.1 + i * 0.35;
                return (
                  <div key={p} style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 25, color: on ? T.text : T.muted }}>
                    <span
                      style={{
                        width: 26, height: 26, borderRadius: 6, border: `2px solid ${on ? T.indigo : T.lineStrong}`, background: on ? T.indigo : "transparent",
                        display: "grid", placeItems: "center", scale: `${on ? 1 + 0.25 * pulse(t, projects + i * 0.35, 0.5) : 1}`,
                      }}
                    >
                      {on && <Icon name="check" size={18} color="#fff" stroke={3} />}
                    </span>
                    {p}
                  </div>
                );
              })}
            </div>
            <div
              style={{
                display: "grid", gap: 8, padding: "14px 16px", borderRadius: 10, background: T.card,
                border: `1px solid ${pulse(t, token, 1.6) > 0.05 ? T.indigoSoft : T.line}`,
                boxShadow: `0 0 ${40 * pulse(t, token, 1.6)}px rgba(94,106,210,.5)`, opacity: prog(t, connected - 0.4, 0.6),
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, fontFamily: T.mono, fontSize: 23, color: T.text }}>
                <Icon name="lock" size={20} color={T.indigoSoft} /> rbt_7Kx2••••••••••••
              </div>
              <div style={{ fontSize: 19, color: T.muted }}>Shown once · stored as a SHA-256 hash · revoke any time</div>
            </div>
          </div>
        </div>
      </AbsoluteFill>
    </Scene>
  );
};
