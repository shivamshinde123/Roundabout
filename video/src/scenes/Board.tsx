import React from "react";
import { AbsoluteFill, interpolate } from "remotion";
import { enter, pop, prog, pulse, useSeconds } from "../anim";
import { Scene, wordAt } from "../components/Scene";
import { AppWindow, Badge, Column, Icon, type Status, TaskCard } from "../components/ui";
import { T } from "../theme";

type CardSpec = { title: string; client?: string; note?: string; badge?: { kind: "wait" | "hand" | "block" | "stall"; label: string; word: string } };

const COLS: { status: Status; cards: CardSpec[] }[] = [
  { status: "backlog", cards: [{ title: "Dark mode for settings" }, { title: "Audit image sizes" }] },
  { status: "todo", cards: [{ title: "Add pricing page", client: "codex", badge: { kind: "wait", label: "Waiting for pickup", word: "waiting" } }] },
  {
    status: "in_progress",
    cards: [
      { title: "Fix login redirect", client: "claude_code", note: "Next: test expired sessions", badge: { kind: "hand", label: "Handoff → Codex", word: "handed" } },
      { title: "Migrate to API v2", client: "cursor", badge: { kind: "block", label: "Blocked", word: "blocked" } },
      { title: "Update the docs", client: "gemini_cli", badge: { kind: "stall", label: "Stalled · 26 h", word: "stalled" } },
    ],
  },
  { status: "review", cards: [{ title: "Hero section", client: "claude_code", note: "PR #14: responsive hero with new copy" }] },
  { status: "done", cards: [{ title: "Footer links", client: "copilot" }, { title: "Cookie banner", client: "codex" }] },
];

export const Board: React.FC = () => {
  const t = useSeconds();
  const tilt = prog(t, 0, 1.6);
  const backlog = wordAt("board", "Backlog");
  const done = wordAt("board", "Done");
  return (
    <Scene vo="board">
      <AbsoluteFill style={{ alignItems: "center", paddingTop: 56 }}>
        <div
          style={{
            width: 1720, height: 840,
            transform: `perspective(2400px) rotateX(${interpolate(tilt, [0, 1], [24, 0])}deg)`,
            translate: `0 ${(1 - tilt) * 120}px`, opacity: tilt,
          }}
        >
          <AppWindow style={{ width: "100%", height: "100%" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 14, alignItems: "start" }}>
              {COLS.map((col, ci) => {
                const hl = col.status === "backlog" ? pulse(t, backlog, 1.2) : col.status === "done" ? pulse(t, done, 1.2) : 0;
                return (
                  <Column
                    key={col.status}
                    status={col.status}
                    count={col.cards.length}
                    scale={1.2}
                    style={{ ...enter(t, 0.7 + ci * 0.12, 0.7, 30), border: `1px solid ${hl > 0.05 ? T.indigo : T.line}`, boxShadow: `0 0 ${40 * hl}px rgba(94,106,210,.45)` }}
                  >
                    {col.cards.map((c, i) => {
                      const at = c.badge ? wordAt("board", c.badge.word) : 0;
                      const glow = c.badge ? pulse(t, at, 1.4) : 0;
                      return (
                        <TaskCard
                          key={c.title}
                          scale={1.2}
                          title={c.title}
                          client={c.client}
                          note={c.note}
                          style={{
                            ...enter(t, 1.0 + ci * 0.15 + i * 0.12, 0.6, 22),
                            borderColor: glow > 0.05 ? T.indigoSoft : T.line,
                            boxShadow: `0 6px 20px rgba(0,0,0,.25), 0 0 ${46 * glow}px rgba(94,106,210,.6)`,
                            scale: `${1 + glow * 0.04}`,
                          }}
                          badge={
                            c.badge && (
                              <div style={pop(t, at - 0.1)}>
                                <Badge kind={c.badge.kind} size={20}>
                                  {c.badge.kind === "block" && <Icon name="blocker" size={15} />}
                                  {c.badge.kind === "hand" && <Icon name="handoff" size={15} />}
                                  {c.badge.label}
                                </Badge>
                              </div>
                            )
                          }
                        />
                      );
                    })}
                  </Column>
                );
              })}
            </div>
          </AppWindow>
        </div>
      </AbsoluteFill>
    </Scene>
  );
};
