import React from "react";
import { AbsoluteFill, interpolate } from "remotion";
import { EASE, enter, pop, prog, pulse, useSeconds } from "../anim";
import { Scene, wordAt } from "../components/Scene";
import { Avatar, Badge, H, Icon, Kicker } from "../components/ui";
import { T } from "../theme";

const Agent: React.FC<{ client: string; name: string; glow: number; style?: React.CSSProperties }> = ({ client, name, glow, style }) => (
  <div style={{ display: "grid", justifyItems: "center", gap: 12, ...style }}>
    <Avatar client={client} size={150} glow={glow} />
    <span style={{ fontSize: 30, fontWeight: 600, color: T.text }}>{name}</span>
  </div>
);

export const Handoff: React.FC = () => {
  const t = useSeconds();
  const hand = wordAt("handoff", "hand");
  const codex = wordAt("handoff", "Codex");
  const done = wordAt("handoff", "done");
  const next = wordAt("handoff", "next");
  const stuck = wordAt("handoff", "Stuck");
  const answer = wordAt("handoff", "answer");
  const back = wordAt("handoff", "back");

  const travel = prog(t, hand - 0.2, codex - hand + 0.6, EASE);
  const accepted = prog(t, next + 0.9, 0.4);
  const reply = prog(t, answer - 0.1, back - answer + 0.4, EASE);
  const resolved = prog(t, back + 0.2, 0.5);

  return (
    <Scene vo="handoff">
      <AbsoluteFill style={{ padding: "84px 120px 0" }}>
        <div style={enter(t, 0.2)}>
          <Kicker>Handoffs and blockers</Kicker>
        </div>
        <H size={76} style={{ marginTop: 18, ...enter(t, 0.4) }}>
          Pass the work on. Ask for help.
        </H>
      </AbsoluteFill>

      {/* Left: the handoff */}
      <div style={{ position: "absolute", left: 120, top: 310, width: 840, height: 580 }}>
        <Agent client="claude_code" name="Claude Code" glow={pulse(t, hand, 1)} style={{ position: "absolute", left: 0, top: 0, ...enter(t, 0.6) }} />
        <Agent client="codex" name="Codex" glow={Math.max(pulse(t, codex, 1.2), accepted * 0.4)} style={{ position: "absolute", right: 30, top: 0, ...enter(t, 0.8) }} />
        <svg width={840} height={200} style={{ position: "absolute", left: 0, top: 0 }}>
          <path
            d="M 170 75 C 350 -5, 530 -5, 655 75"
            fill="none" stroke={T.violet} strokeWidth={3} strokeLinecap="round"
            opacity={0.3 + travel * 0.6} pathLength={1000} strokeDasharray={`${travel * 1000} 1000`}
          />
        </svg>
        <div
          style={{
            position: "absolute", top: 240, left: interpolate(travel, [0, 1], [-20, 180]), width: 650,
            background: T.panel, border: `1px solid rgba(187,135,252,.45)`, borderRadius: 16, padding: 24, display: "grid", gap: 14,
            boxShadow: `0 30px 80px -20px rgba(0,0,0,.8), 0 0 ${50 * pulse(t, codex, 1.2)}px rgba(187,135,252,.45)`,
            opacity: prog(t, hand - 0.3, 0.4), rotate: `${Math.sin(travel * Math.PI) * -2}deg`,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Badge kind="hand" size={23}>
              <Icon name="handoff" size={20} /> Handoff → Codex
            </Badge>
            <span style={{ marginLeft: "auto", ...pop(t, next + 0.9) }}>
              <Badge kind="wait" size={18} style={{ color: T.green, borderColor: "rgba(76,183,130,.45)", background: "rgba(76,183,130,.1)" }}>
                <Icon name="check" size={16} /> Accepted
              </Badge>
            </span>
          </div>
          <div style={{ fontSize: 27, color: T.text, ...enter(t, done - 0.1, 0.5, 10) }}>
            <span style={{ color: T.muted }}>Done: </span>login fix and unit tests
          </div>
          <div style={{ fontSize: 27, color: T.text, ...enter(t, next - 0.1, 0.5, 10) }}>
            <span style={{ color: T.muted }}>Next: </span>the expired-session edge case
          </div>
        </div>
      </div>

      {/* Right: the blocker round trip */}
      <div style={{ position: "absolute", left: 1010, top: 310, width: 790 }}>
        <div
          style={{
            background: T.panel, borderRadius: 16, padding: 28, display: "grid", gap: 14,
            border: `1px solid ${resolved > 0.5 ? "rgba(76,183,130,.5)" : "rgba(235,87,87,.5)"}`,
            boxShadow: `0 30px 80px -20px rgba(0,0,0,.8), 0 0 ${44 * pulse(t, stuck, 1.3)}px rgba(235,87,87,.5)`,
            ...enter(t, stuck - 0.2, 0.6, 30),
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 25 }}>
            <Avatar client="codex" size={38} />
            <span style={{ color: T.text, fontWeight: 600 }}>Codex</span>
            <span style={{ marginLeft: "auto" }}>
              {resolved > 0.5 ? (
                <Badge kind="wait" size={19} style={{ color: T.green, borderColor: "rgba(76,183,130,.45)", background: "rgba(76,183,130,.1)", ...pop(t, back + 0.2) }}>
                  <Icon name="shield" size={17} /> Resolved
                </Badge>
              ) : (
                <Badge kind="block" size={19}>
                  <Icon name="blocker" size={17} /> Blocked
                </Badge>
              )}
            </span>
          </div>
          <div style={{ fontSize: 29, color: T.text }}>No access to the staging database.</div>
          <div style={{ fontSize: 25, color: T.soft }}>
            <span style={{ color: T.muted }}>Question: </span>Can you add read access for me?
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 14, margin: "30px 0 0 24px", fontSize: 24, color: T.muted, ...enter(t, stuck + 0.8, 0.5, 10) }}>
          <Icon name="inbox" size={24} color={T.coral} />
          Lands in <span style={{ color: T.text, fontWeight: 600 }}>Needs your input</span>
          <span style={{ background: "rgba(235,87,87,.18)", color: "#f0a0a0", borderRadius: 99, fontSize: 17, padding: "1px 10px", opacity: 1 - resolved }}>1</span>
        </div>

        <div
          style={{
            marginTop: 30, marginLeft: interpolate(reply, [0, 1], [230, 0]), width: 600, background: "rgba(94,106,210,.14)",
            border: `1px solid rgba(94,106,210,.5)`, borderRadius: 16, padding: "18px 22px", display: "grid", gap: 6, opacity: prog(t, answer - 0.2, 0.4),
          }}
        >
          <span style={{ fontSize: 21, color: T.indigoSoft, fontWeight: 600 }}>You</span>
          <span style={{ fontSize: 27, color: T.text }}>Done: read access added. Carry on.</span>
        </div>
      </div>
    </Scene>
  );
};
