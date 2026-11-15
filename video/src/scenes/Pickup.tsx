import React from "react";
import { AbsoluteFill, interpolate } from "remotion";
import { EASE, enter, pop, prog, pulse, useSeconds } from "../anim";
import { Scene, wordAt } from "../components/Scene";
import { Avatar, Badge, Column, H, Kicker, StatusIcon, TaskCard, Terminal } from "../components/ui";
import { T } from "../theme";

const S = 1.5; // board zoom
const COL_W = 450;

const Line: React.FC<{ t: number; at: number; children: React.ReactNode; color?: string }> = ({ t, at, children, color = "#cfcfd6" }) => (
  <div style={{ color, minHeight: 38, ...enter(t, at, 0.4, 10) }}>{children}</div>
);

export const Pickup: React.FC = () => {
  const t = useSeconds();
  const assign = wordAt("pickup", "Assign");
  const picks = wordAt("pickup", "picks");
  const glides = wordAt("pickup", "glides");
  const race = wordAt("pickup", "race");
  const move = prog(t, glides - 0.2, 1.1, EASE);
  const waiting = 1 - prog(t, glides - 0.3, 0.3);

  return (
    <Scene vo="pickup">
      <AbsoluteFill style={{ padding: "84px 120px 0" }}>
        <div style={enter(t, 0.2)}>
          <Kicker>Pickup</Kicker>
        </div>
        <H size={76} style={{ marginTop: 18, ...enter(t, 0.4) }}>
          Assign it. The agent claims it.
        </H>

        <div style={{ display: "flex", gap: 50, marginTop: 50, alignItems: "flex-start" }}>
          {/* Two columns of the board, zoomed in. */}
          <div style={{ position: "relative", width: COL_W * 2 + 30, height: 590, ...enter(t, 0.6, 0.7, 30) }}>
            <Column status="todo" count={move > 0.5 ? 0 : 1} scale={S} style={{ position: "absolute", left: 0, top: 0, width: COL_W, height: 590 }} />
            <Column status="in_progress" count={move > 0.5 ? 2 : 1} scale={S} style={{ position: "absolute", left: COL_W + 30, top: 0, width: COL_W, height: 590 }}>
              <TaskCard title="Fix login redirect" client="claude_code" scale={S} />
            </Column>
            <div
              style={{
                position: "absolute", width: COL_W - 30, top: interpolate(move, [0, 1], [78, 222]),
                left: interpolate(move, [0, 1], [15, COL_W + 30 + 15]), rotate: `${Math.sin(move * Math.PI) * 3}deg`,
                scale: `${1 + Math.sin(move * Math.PI) * 0.05}`, ...enter(t, assign - 0.3, 0.6, 20),
              }}
            >
              <TaskCard
                title="Add pricing page"
                client="codex"
                scale={S}
                style={{
                  borderColor: pulse(t, assign, 1.2) + Math.sin(move * Math.PI) > 0.05 ? T.indigoSoft : T.line,
                  boxShadow: `0 ${20 + Math.sin(move * Math.PI) * 30}px 60px rgba(0,0,0,.5), 0 0 ${40 * Math.max(pulse(t, assign, 1.2), Math.sin(move * Math.PI))}px rgba(94,106,210,.55)`,
                }}
                badge={
                  waiting > 0.02 ? (
                    <div style={{ opacity: waiting }}>
                      <Badge kind="wait" size={22}>Waiting for pickup</Badge>
                    </div>
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 22, color: T.yellow, ...pop(t, glides + 0.5) }}>
                      <StatusIcon status="in_progress" size={20} /> Accepted by Codex
                    </div>
                  )
                }
              />
            </div>
          </div>

          {/* What the agent actually calls. */}
          <Terminal
            title={
              <>
                <Avatar client="codex" size={28} /> Codex · Roundabout tools
              </>
            }
            style={{ width: 700, ...enter(t, picks - 0.6, 0.6, 30) }}
          >
            <Line t={t} at={picks - 0.2} color={T.text}>→ list_assignments()</Line>
            <Line t={t} at={picks + 0.4} color={T.muted}>{'← waiting: ["Add pricing page"]'}</Line>
            <Line t={t} at={picks + 1.0} color={T.text}>→ accept_task(request_id: r1)</Line>
            <Line t={t} at={glides + 0.4} color={T.green}>← status: in_progress ✓</Line>
            <div style={{ minHeight: 24 }} />
            <Line t={t} at={race - 0.3} color={T.muted}>{"// two claims at once"}</Line>
            <Line t={t} at={race} color={T.green}>→ accept_task  r1  ✓ won</Line>
            <Line t={t} at={race + 0.25} color="#f4a3a3">→ accept_task  r2  ✕ CONFLICT</Line>
          </Terminal>
        </div>
      </AbsoluteFill>
    </Scene>
  );
};
