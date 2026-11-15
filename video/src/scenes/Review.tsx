import React from "react";
import { AbsoluteFill, interpolate } from "remotion";
import { EASE, enter, pop, prog, pulse, useSeconds } from "../anim";
import { Scene, wordAt } from "../components/Scene";
import { Avatar, Column, H, Icon, Kicker, StatusIcon, TaskCard } from "../components/ui";
import { T } from "../theme";

const S = 1.5;
const COL_W = 450;

export const Review: React.FC = () => {
  const t = useSeconds();
  const submits = wordAt("review", "submits");
  const link = wordAt("review", "link");
  const def = wordAt("review", "default");
  const approve = wordAt("review", "approve");
  const click = approve + 0.15;
  const move = prog(t, click + 0.3, 1.0, EASE);

  // Cursor glides to the Approve button, then clicks.
  const cur = prog(t, approve - 1.2, 1.1, EASE);
  const press = pulse(t, click, 0.35);

  return (
    <Scene vo="review">
      <AbsoluteFill style={{ padding: "84px 120px 0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18, ...enter(t, 0.2) }}>
          <Kicker>Results and review</Kicker>
          <span style={{ ...pop(t, def - 0.1), fontSize: 22, color: T.text, background: T.panel, border: `1px solid ${T.lineStrong}`, borderRadius: 99, padding: "6px 16px", display: "inline-flex", gap: 10, alignItems: "center" }}>
            <Icon name="shield" size={20} color={T.green} /> Review on by default · agents can&apos;t switch it off
          </span>
        </div>
        <H size={76} style={{ marginTop: 18, ...enter(t, 0.4) }}>
          You decide what&apos;s done.
        </H>

        <div style={{ display: "flex", gap: 50, marginTop: 50, alignItems: "flex-start" }}>
          <div style={{ position: "relative", width: COL_W * 2 + 30, height: 590, ...enter(t, 0.6, 0.7, 30) }}>
            <Column status="review" count={move > 0.5 ? 0 : 1} scale={S} style={{ position: "absolute", left: 0, top: 0, width: COL_W, height: 590 }} />
            <Column status="done" count={move > 0.5 ? 3 : 2} scale={S} style={{ position: "absolute", left: COL_W + 30, top: 0, width: COL_W, height: 590 }}>
              <TaskCard title="Footer links" client="copilot" scale={S} />
              <TaskCard title="Cookie banner" client="codex" scale={S} />
            </Column>
            <div
              style={{
                position: "absolute", width: COL_W - 30, top: interpolate(move, [0, 1], [78, 366]),
                left: interpolate(move, [0, 1], [15, COL_W + 30 + 15]), rotate: `${Math.sin(move * Math.PI) * 3}deg`,
                ...enter(t, submits - 0.3, 0.6, 20),
              }}
            >
              <TaskCard
                title="Hero section"
                client="claude_code"
                scale={S}
                style={{ borderColor: move > 0.98 ? T.indigo : T.line, boxShadow: `0 20px 60px rgba(0,0,0,.5), 0 0 ${50 * pulse(t, click + 1.3, 1.2)}px rgba(94,106,210,.7)` }}
                badge={
                  move > 0.98 ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 22, color: T.indigoSoft, ...pop(t, click + 1.3) }}>
                      <StatusIcon status="done" size={20} /> Approved by you
                    </div>
                  ) : (
                    <div style={{ fontSize: 21, color: T.muted, lineHeight: 1.4 }}>PR #14: responsive hero with new copy</div>
                  )
                }
              />
            </div>
          </div>

          {/* The result as the owner sees it. */}
          <div
            style={{
              width: 700, background: T.panel, border: `1px solid ${T.line}`, borderRadius: 16, padding: 32, display: "grid", gap: 22, alignContent: "start",
              boxShadow: "0 30px 90px -20px rgba(0,0,0,.7)", position: "relative", ...enter(t, submits, 0.7, 30),
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 23, color: T.muted }}>
              <Icon name="file" size={22} color={T.teal} />
              <Avatar client="claude_code" size={30} />
              <span><b style={{ color: T.text, fontWeight: 600 }}>Claude Code</b> submitted a result</span>
            </div>
            <div style={{ fontSize: 34, color: T.white, fontWeight: 600, lineHeight: 1.25 }}>PR #14 opened: responsive hero with new copy</div>
            <div style={{ fontSize: 23, color: T.soft, lineHeight: 1.5 }}>Rebuilt the hero for mobile, updated the copy, and added a visual test.</div>
            <div
              style={{
                display: "inline-flex", alignItems: "center", gap: 10, width: "fit-content", fontSize: 20, padding: "6px 14px", borderRadius: 8,
                background: T.column, border: `1px solid ${pulse(t, link, 1.3) > 0.05 ? T.indigoSoft : T.lineStrong}`, color: T.text, ...pop(t, link - 0.1),
              }}
            >
              <Icon name="github" size={20} color={T.muted} /> github.com/acme/website/pull/14
            </div>
            <div style={{ display: "flex", gap: 14, marginTop: 8 }}>
              <div
                style={{
                  height: 58, padding: "0 26px", borderRadius: 10, background: move > 0 ? "#4f5bc4" : T.indigo, color: "#fff", fontSize: 22, fontWeight: 600,
                  display: "flex", alignItems: "center", gap: 10, scale: `${1 - press * 0.06}`, boxShadow: `0 0 ${40 * press}px rgba(94,106,210,.8)`,
                }}
              >
                <Icon name="check" size={22} stroke={2.6} /> Approve
              </div>
              <div style={{ height: 58, padding: "0 24px", borderRadius: 10, border: `1px solid ${T.lineStrong}`, color: T.text, fontSize: 22, display: "flex", alignItems: "center", gap: 10 }}>
                <Icon name="rotate" size={20} /> Request changes
              </div>
            </div>
            {/* Pointer */}
            <div
              style={{
                position: "absolute", left: interpolate(cur, [0, 1], [560, 112]), top: interpolate(cur, [0, 1], [600, 374]),
                opacity: prog(t, approve - 1.3, 0.3) * (1 - prog(t, click + 1.2, 0.4)), scale: `${1 - press * 0.15}`,
              }}
            >
              <Icon name="cursor" size={40} color="#fff" stroke={1.6} style={{ fill: "#111", filter: "drop-shadow(0 4px 10px rgba(0,0,0,.6))" }} />
            </div>
          </div>
        </div>
      </AbsoluteFill>
    </Scene>
  );
};
