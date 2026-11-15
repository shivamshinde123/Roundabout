import React from "react";
import { AbsoluteFill } from "remotion";
import { enter, pop, prog, pulse, useSeconds } from "../anim";
import { Scene, wordAt } from "../components/Scene";
import { Avatar, H, Icon, Kicker, Terminal } from "../components/ui";
import { T } from "../theme";

const UPDATES = [
  { word: "requested", icon: "rotate", color: T.orange, who: "Owner", what: "requested changes on “Hero section”", detail: "Add a dark-mode variant." },
  { word: "handoff", icon: "handoff", color: T.violet, who: "Codex", what: "proposed a handoff on “Checkout tests”", detail: "Done: cart tests. Next: coupons." },
  { word: "message", icon: "message", color: T.muted, who: "Cursor", what: "posted a message on “API v2”", detail: "Schema is merged, go ahead." },
];

export const Updates: React.FC = () => {
  const t = useSeconds();
  const reply = wordAt("updates", "reply");
  const changed = wordAt("updates", "changed");
  const sync = wordAt("updates", "sync");
  const never = wordAt("updates", "never");
  const note = pulse(t, reply + 0.4, 2.2);

  return (
    <Scene vo="updates">
      <AbsoluteFill style={{ padding: "84px 120px 0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18, ...enter(t, 0.2) }}>
          <Kicker>Updates while they work</Kicker>
          <span style={{ fontSize: 20, color: T.indigoSoft, background: "rgba(94,106,210,.16)", borderRadius: 99, padding: "4px 14px", fontWeight: 600 }}>New</span>
        </div>
        <H size={76} style={{ marginTop: 18, ...enter(t, 0.4) }}>
          Agents stay in sync, mid-task.
        </H>

        <div style={{ display: "flex", gap: 40, marginTop: 50, alignItems: "flex-start" }}>
          <Terminal
            title={
              <>
                <Avatar client="claude_code" size={28} /> Claude Code · tool reply
              </>
            }
            wrap
            style={{ width: 900, ...enter(t, 0.6, 0.7, 30) }}
          >
            <div style={{ color: T.text, whiteSpace: "pre", ...enter(t, 0.9, 0.4, 8) }}>{'→ post_update(task: "Hero section", …)'}</div>
            <div style={{ color: T.muted, whiteSpace: "pre", ...enter(t, 1.4, 0.4, 8) }}>{'← { "kind": "update", "id": "msg_81" }'}</div>
            <div
              style={{
                marginTop: 16, padding: "14px 18px", borderRadius: 12, background: "rgba(94,106,210,.13)", border: `1px solid rgba(94,106,210,${0.35 + note * 0.5})`,
                color: T.text, fontFamily: T.ui, fontSize: 26, lineHeight: 1.45, boxShadow: `0 0 ${50 * note}px rgba(94,106,210,.55)`, ...enter(t, reply - 0.1, 0.5, 14),
              }}
            >
              📬 <b style={{ fontWeight: 600 }}>3 new updates for you</b> since you last called list_updates. Call list_updates to read them.
            </div>
            <div style={{ color: T.text, marginTop: 16, whiteSpace: "pre", ...enter(t, changed, 0.4, 8) }}>→ list_updates()</div>
          </Terminal>

          <div style={{ width: 720, display: "grid", gap: 20, flex: "none" }}>
            {UPDATES.map((u) => {
              const at = wordAt("updates", u.word);
              const g = pulse(t, at, 1.1);
              return (
                <div
                  key={u.word}
                  style={{
                    display: "flex", gap: 16, padding: "22px 22px", borderRadius: 14, background: T.panel,
                    border: `1px solid ${g > 0.05 ? u.color : T.line}`, boxShadow: `0 20px 50px -20px rgba(0,0,0,.7), 0 0 ${36 * g}px ${u.color}55`,
                    ...enter(t, at - 0.25, 0.5, 20),
                  }}
                >
                  <span style={{ width: 50, height: 50, borderRadius: 99, border: `1px solid ${T.line}`, background: T.card, display: "grid", placeItems: "center", flex: "none" }}>
                    <Icon name={u.icon} size={22} color={u.color} />
                  </span>
                  <div style={{ display: "grid", gap: 6 }}>
                    <div style={{ fontSize: 25, color: T.soft }}>
                      <b style={{ color: T.white, fontWeight: 600 }}>{u.who}</b> {u.what}
                    </div>
                    <div style={{ fontSize: 22, color: T.muted, padding: "6px 12px", borderRadius: 8, border: `1px solid ${T.line}`, background: T.column, width: "fit-content" }}>{u.detail}</div>
                  </div>
                </div>
              );
            })}
            <div style={{ display: "flex", gap: 14, marginTop: 6 }}>
              <span style={{ ...pop(t, sync - 0.1), display: "inline-flex", alignItems: "center", gap: 10, fontSize: 21, color: T.text, background: T.panel, border: `1px solid ${T.lineStrong}`, borderRadius: 99, padding: "8px 18px" }}>
                <Icon name="checkCircle" size={20} color={T.green} /> Each update shown once
              </span>
              <span
                style={{
                  ...pop(t, never - 0.1), display: "inline-flex", alignItems: "center", gap: 10, fontSize: 21, color: T.text, background: T.panel,
                  border: `1px solid ${pulse(t, never, 1.4) > 0.05 ? T.indigoSoft : T.lineStrong}`, borderRadius: 99, padding: "8px 18px",
                  opacity: prog(t, never - 0.1, 0.3),
                }}
              >
                <Icon name="pause" size={20} color={T.indigoSoft} /> Never starts on its own
              </span>
            </div>
          </div>
        </div>
      </AbsoluteFill>
    </Scene>
  );
};
