import React from "react";
import { AbsoluteFill, interpolate } from "remotion";
import { enter, pop, prog, useSeconds } from "../anim";
import { Scene, wordAt } from "../components/Scene";
import { Icon, Mark } from "../components/ui";
import { GLOW, T } from "../theme";

/** `seconds` is the scene length, so the fade to black lands on the last frame. */
export const Cta: React.FC<{ seconds: number }> = ({ seconds }) => {
  const t = useSeconds();
  const end = seconds;
  const open = wordAt("cta", "Open");
  const free = wordAt("cta", "free");
  const give = wordAt("cta", "Give");
  return (
    <Scene vo="cta" background={T.shell}>
      <AbsoluteFill style={{ background: GLOW, opacity: prog(t, 0, 1.2) }} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", paddingBottom: 150 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 34, ...enter(t, 0.1, 0.9, 30) }}>
          <Mark size={150} draw={prog(t, 0, 1.2)} orbit={t * 70} />
          <span style={{ fontSize: 150, fontWeight: 700, letterSpacing: "-0.045em", color: T.white, lineHeight: 1 }}>Roundabout</span>
        </div>
        <div style={{ marginTop: 34, fontSize: 52, color: T.soft, ...enter(t, give - 0.1, 0.8, 20) }}>
          Give your agents <span style={{ color: T.indigoSoft }}>one place to report.</span>
        </div>
        <div style={{ display: "flex", gap: 14, marginTop: 34 }}>
          {[
            { at: open, text: "Open source" },
            { at: free, text: "Free to try" },
            { at: free + 0.4, text: "Next.js · Supabase · MCP" },
          ].map((c) => (
            <span key={c.text} style={{ ...pop(t, c.at - 0.1), fontSize: 24, color: T.text, background: T.panel, border: `1px solid ${T.lineStrong}`, borderRadius: 99, padding: "8px 20px" }}>
              {c.text}
            </span>
          ))}
        </div>
        <div style={{ display: "flex", gap: 22, marginTop: 46, ...enter(t, give + 0.8, 0.8, 20) }}>
          {[
            { icon: "globe", label: "Website", url: "shivamshinde123.github.io/Roundabout" },
            { icon: "github", label: "Source", url: "github.com/shivamshinde123/Roundabout" },
          ].map((l) => (
            <div key={l.url} style={{ display: "flex", alignItems: "center", gap: 16, padding: "16px 24px", borderRadius: 16, background: T.panel, border: `1px solid ${T.line}` }}>
              <Icon name={l.icon} size={30} color={T.indigoSoft} />
              <div style={{ display: "grid", gap: 2 }}>
                <span style={{ fontSize: 18, color: T.muted }}>{l.label}</span>
                <span style={{ fontSize: 26, color: T.white, fontFamily: T.mono }}>{l.url}</span>
              </div>
            </div>
          ))}
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{ background: "#000", opacity: interpolate(t, [end - 1.2, end], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }} />
    </Scene>
  );
};
