// The app's building blocks, redrawn for video with the same tokens (src/lib/visual.tsx, board, activity feed).
import React from "react";
import { CLIENT_LOGOS } from "../../../src/lib/client-logos";
import { T } from "../theme";

export type Status = "backlog" | "todo" | "in_progress" | "review" | "done";

export const STATUS: Record<Status, { label: string; color: string }> = {
  backlog: { label: "Backlog", color: "#8d8d95" },
  todo: { label: "To Do", color: "#c4c4cc" },
  in_progress: { label: "In Progress", color: T.yellow },
  review: { label: "Review", color: T.green },
  done: { label: "Done", color: T.indigo },
};

export const StatusIcon: React.FC<{ status: Status; size?: number }> = ({ status, size = 22 }) => {
  const c = STATUS[status].color;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} style={{ flex: "none" }}>
      {status === "backlog" && <circle cx="12" cy="12" r="9" strokeDasharray="3.2 3.2" />}
      {status === "todo" && <circle cx="12" cy="12" r="9" />}
      {status === "in_progress" && (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 3a9 9 0 0 1 0 18z" fill={c} />
        </>
      )}
      {status === "review" && (
        <>
          <circle cx="12" cy="12" r="9" />
          <circle cx="12" cy="12" r="2.6" fill={c} />
        </>
      )}
      {status === "done" && (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="m8.5 12 2.5 2.5 4.5-5" />
        </>
      )}
    </svg>
  );
};

export const CLIENT_NAMES: Record<string, string> = {
  claude_code: "Claude Code", codex: "Codex", cursor: "Cursor", windsurf: "Windsurf", gemini_cli: "Gemini CLI",
  copilot: "GitHub Copilot", cline: "Cline", opencode: "OpenCode", zed: "Zed", warp: "Warp", jetbrains: "JetBrains AI",
  claude_ai: "Claude", claude_duet: "Claude Duet", chatgpt: "ChatGPT", dots: "ChatGPT dots", gemini_app: "Gemini",
  grok: "Grok", grok_bot: "Grok Bot", muse: "Meta Muse", instinct: "Instinct", other: "Any MCP client",
};

/** Grey circle with the client's mark, as in the app (D-39). */
export const Avatar: React.FC<{ client: string; size?: number; glow?: number; style?: React.CSSProperties }> = ({ client, size = 30, glow = 0, style }) => {
  const logo = CLIENT_LOGOS[client];
  return (
    <span
      style={{
        width: size, height: size, borderRadius: "50%", background: "#2a2a2f", color: "#d4d4d8",
        display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "none",
        boxShadow: `0 0 0 1px rgba(255,255,255,.1), 0 0 ${40 * glow}px ${12 * glow}px rgba(94,106,210,${0.55 * glow})`,
        ...style,
      }}
    >
      {logo ? (
        <svg width={size * 0.62} height={size * 0.62} viewBox="0 0 24 24" fill="currentColor">
          <path d={logo.d} fillRule={logo.evenOdd ? "evenodd" : undefined} clipRule={logo.evenOdd ? "evenodd" : undefined} />
        </svg>
      ) : client === "instinct" ? (
        <Icon name="message" size={size * 0.6} />
      ) : (
        <Icon name="bot" size={size * 0.6} />
      )}
    </span>
  );
};

const ICONS: Record<string, React.ReactNode> = {
  handoff: <path d="m16 3 4 4-4 4M20 7H4M8 21l-4-4 4-4M4 17h16" />,
  blocker: (
    <>
      <path d="M7.86 2h8.28L22 7.86v8.28L16.14 22H7.86L2 16.14V7.86z" />
      <path d="M12 8v4M12 16h.01" />
    </>
  ),
  shield: (
    <>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  check: <path d="M20 6 9 17l-5-5" />,
  checkCircle: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12 2.5 2.5 4.5-5" />
    </>
  ),
  x: <path d="M18 6 6 18M6 6l12 12" />,
  lock: (
    <>
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </>
  ),
  db: (
    <>
      <ellipse cx="12" cy="5" rx="8" ry="3" />
      <path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
    </>
  ),
  plug: <path d="M12 22v-5M9 8V2M15 8V2M18 8v5a6 6 0 0 1-12 0V8z" />,
  rules: (
    <>
      <path d="M12 3v18M5 7h14M5 7l-3 7a3 3 0 0 0 6 0zM19 7l-3 7a3 3 0 0 0 6 0z" />
    </>
  ),
  message: <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />,
  bot: (
    <>
      <rect x="4" y="8" width="16" height="12" rx="2" />
      <path d="M12 4v4M9 13h.01M15 13h.01" />
    </>
  ),
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </>
  ),
  rotate: (
    <>
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
      <path d="M3 3v5h5" />
    </>
  ),
  pause: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M10 9v6M14 9v6" />
    </>
  ),
  file: (
    <>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6M9 15l2 2 4-4" />
    </>
  ),
  link: <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" />,
  github: <path d="M9 19c-4.3 1.4-4.3-2.5-6-3m12 5v-3.5c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.2 4.2 0 0 0-.1-3.2s-1.1-.3-3.5 1.3a12.3 12.3 0 0 0-6.2 0C6.5 2.8 5.4 3.1 5.4 3.1a4.2 4.2 0 0 0-.1 3.2A4.6 4.6 0 0 0 4 9.5c0 4.6 2.7 5.7 5.5 6-.6.6-.6 1.2-.5 2V21" />,
  sparkles: <path d="M12 3l1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2zM19 3v4M21 5h-4" />,
  inbox: (
    <>
      <path d="M22 12h-6l-2 3h-4l-2-3H2" />
      <path d="M5.5 5h13L22 12v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6z" />
    </>
  ),
  cursor: <path d="M4 4l7 17 2.5-7.5L21 11z" />,
};

export const Icon: React.FC<{ name: keyof typeof ICONS | string; size?: number; color?: string; stroke?: number; style?: React.CSSProperties }> = ({
  name, size = 22, color = "currentColor", stroke = 2, style,
}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none", ...style }}>
    {ICONS[name]}
  </svg>
);

export type BadgeKind = "wait" | "hand" | "block" | "stall" | "noaccess";
const BADGES: Record<BadgeKind, { fg: string; bd: string; bg: string }> = {
  wait: { fg: "#c4c4cc", bd: T.lineStrong, bg: "rgba(141,141,149,.1)" },
  hand: { fg: "#d4b8fd", bd: "rgba(187,135,252,.4)", bg: "rgba(187,135,252,.1)" },
  block: { fg: "#f4a3a3", bd: "rgba(235,87,87,.45)", bg: "rgba(235,87,87,.1)" },
  stall: { fg: "#f6c48f", bd: "rgba(242,153,74,.4)", bg: "rgba(242,153,74,.1)" },
  noaccess: { fg: "#f4a3a3", bd: "rgba(235,87,87,.45)", bg: "rgba(235,87,87,.1)" },
};

export const Badge: React.FC<{ kind: BadgeKind; children: React.ReactNode; size?: number; style?: React.CSSProperties }> = ({ kind, children, size = 17, style }) => {
  const b = BADGES[kind];
  return (
    <span
      style={{
        display: "inline-flex", alignItems: "center", gap: 6, width: "fit-content", borderRadius: 6, padding: "2px 9px",
        fontSize: size, fontWeight: 500, color: b.fg, border: `1px solid ${b.bd}`, background: b.bg, whiteSpace: "nowrap", ...style,
      }}
    >
      {children}
    </span>
  );
};

/** A board card: title, assignee and optional detail and badge. */
export const TaskCard: React.FC<{
  title: string;
  client?: string;
  note?: string;
  badge?: React.ReactNode;
  scale?: number;
  style?: React.CSSProperties;
}> = ({ title, client, note, badge, scale = 1, style }) => (
  <div
    style={{
      background: T.card, border: `1px solid ${T.line}`, borderRadius: 10 * scale, padding: 14 * scale,
      display: "grid", gap: 9 * scale, fontSize: 18 * scale, boxShadow: "0 6px 20px rgba(0,0,0,.25)", ...style,
    }}
  >
    <div style={{ color: T.text, fontWeight: 600, lineHeight: 1.3 }}>{title}</div>
    <div style={{ display: "flex", alignItems: "center", gap: 8 * scale, color: T.muted, fontSize: 16 * scale }}>
      {client ? (
        <>
          <Avatar client={client} size={22 * scale} />
          {CLIENT_NAMES[client]}
        </>
      ) : (
        "Unassigned"
      )}
    </div>
    {note && <div style={{ color: T.muted, fontSize: 15 * scale, lineHeight: 1.4 }}>{note}</div>}
    {badge}
  </div>
);

export const Column: React.FC<{ status: Status; count?: number; children?: React.ReactNode; style?: React.CSSProperties; scale?: number }> = ({
  status, count, children, style, scale = 1,
}) => (
  <div
    style={{
      background: T.column, border: `1px solid ${T.line}`, borderRadius: 12 * scale, padding: 10 * scale,
      display: "flex", flexDirection: "column", gap: 10 * scale, ...style,
    }}
  >
    <div style={{ display: "flex", alignItems: "center", gap: 8 * scale, fontSize: 17 * scale, fontWeight: 600, padding: `${4 * scale}px ${4 * scale}px` }}>
      <StatusIcon status={status} size={18 * scale} />
      {STATUS[status].label}
      {count !== undefined && <span style={{ color: T.muted, fontWeight: 400 }}>{count}</span>}
    </div>
    {children}
  </div>
);

/** The app shell: darkest sidebar plane, inset bordered panel (D-31). */
export const AppWindow: React.FC<{ children: React.ReactNode; title?: string; tab?: string; style?: React.CSSProperties; sidebar?: boolean }> = ({
  children, title = "Website", tab = "Boards", style, sidebar = true,
}) => (
  <div
    style={{
      background: T.shell, border: `1px solid ${T.line}`, borderRadius: 18, overflow: "hidden",
      boxShadow: "0 50px 140px -30px rgba(0,0,0,.85), 0 0 0 1px rgba(255,255,255,.03) inset", ...style,
    }}
  >
    <div style={{ display: "flex", gap: 8, padding: "14px 18px", borderBottom: `1px solid ${T.line}` }}>
      {[0, 1, 2].map((i) => (
        <span key={i} style={{ width: 12, height: 12, borderRadius: "50%", background: T.lineStrong }} />
      ))}
    </div>
    <div style={{ display: "flex", height: "calc(100% - 41px)" }}>
      {sidebar && (
        <div style={{ width: 230, padding: "18px 12px", display: "grid", alignContent: "start", gap: 6, fontSize: 16, color: T.muted }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, color: T.white, fontWeight: 600, padding: "0 8px 12px" }}>
            <Mark size={24} /> Roundabout
          </div>
          <div style={{ fontSize: 13, padding: "10px 8px 4px" }}>Projects</div>
          {[
            ["Website", true],
            ["Mobile app", false],
            ["Data pipeline", false],
          ].map(([n, on]) => (
            <div key={n as string} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 7, background: on ? T.hover : "transparent", color: on ? T.text : T.muted }}>
              <Icon name="sparkles" size={16} color="#a1a1aa" />
              {n}
              {on && <span style={{ marginLeft: "auto", background: "rgba(235,87,87,.18)", color: "#f0a0a0", borderRadius: 99, fontSize: 12, padding: "0 8px" }}>2</span>}
            </div>
          ))}
          <div style={{ fontSize: 13, padding: "14px 8px 4px" }}>Workspace</div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px" }}>
            <Icon name="bot" size={16} /> Agents
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px" }}>
            <Icon name="file" size={16} /> Guide
          </div>
        </div>
      )}
      <div style={{ flex: 1, margin: sidebar ? "10px 10px 10px 0" : 10, border: `1px solid ${T.line}`, borderRadius: 14, background: T.panel, padding: 22, minWidth: 0, overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18, marginBottom: 18 }}>
          <div style={{ color: T.white, fontWeight: 600, fontSize: 20 }}>{title}</div>
          <div style={{ display: "flex", gap: 6, fontSize: 15, color: T.muted }}>
            {["Overview", "Needs your input", "Boards ▾", "Activity"].map((x) => (
              <span key={x} style={{ padding: "4px 10px", borderRadius: 7, background: x.startsWith(tab) ? T.hover : "transparent", color: x.startsWith(tab) ? T.text : T.muted }}>
                {x}
              </span>
            ))}
          </div>
        </div>
        {children}
      </div>
    </div>
  </div>
);

/** A terminal or tool-call log panel. */
export const Terminal: React.FC<{ title: React.ReactNode; children: React.ReactNode; style?: React.CSSProperties; fontSize?: number; wrap?: boolean }> = ({
  title, children, style, fontSize = 23, wrap = false,
}) => (
  <div style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 16, overflow: "hidden", boxShadow: "0 30px 90px -20px rgba(0,0,0,.7)", ...style }}>
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 20px", borderBottom: `1px solid ${T.line}`, color: T.muted, fontSize: 19 }}>{title}</div>
    <div style={{ padding: "20px 24px", fontFamily: T.mono, fontSize, lineHeight: 1.65, color: "#cfcfd6", whiteSpace: wrap ? "normal" : "pre" }}>{children}</div>
  </div>
);

/**
 * The Roundabout mark (src/app/icon.svg): an indigo tile with a ring and two agents orbiting it.
 * `draw` 0→1 draws the ring; `orbit` rotates the agents (degrees).
 */
export const Mark: React.FC<{ size?: number; draw?: number; orbit?: number }> = ({ size = 64, draw = 1, orbit = 0 }) => {
  const C = 2 * Math.PI * 15;
  const a = (deg: number, r: number) => [32 + r * Math.sin((deg * Math.PI) / 180), 32 - r * Math.cos((deg * Math.PI) / 180)];
  const [x1, y1] = a(orbit, 15);
  const [x2, y2] = a(orbit + 124, 15);
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" style={{ flex: "none" }}>
      <rect width="64" height="64" rx="14" fill={T.indigo} />
      <circle cx="32" cy="32" r="15" fill="none" stroke="#fff" strokeWidth="5" strokeOpacity="0.95" strokeDasharray={C} strokeDashoffset={C * (1 - draw)} transform="rotate(-90 32 32)" />
      <circle cx={x1} cy={y1} r={6 * Math.min(1, draw * 1.5)} fill="#fff" />
      <circle cx={x2} cy={y2} r={4.5 * Math.min(1, draw * 1.5)} fill="#e4e6ff" />
    </svg>
  );
};

/** Small heading used at the top-left of explainer scenes. */
export const Kicker: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
  <div style={{ display: "inline-flex", alignItems: "center", gap: 10, fontSize: 24, color: T.indigoSoft, fontWeight: 500, letterSpacing: "0.02em", ...style }}>
    <span style={{ width: 8, height: 8, borderRadius: 99, background: T.indigo, boxShadow: `0 0 14px ${T.indigo}` }} />
    {children}
  </div>
);

export const H: React.FC<{ children: React.ReactNode; size?: number; style?: React.CSSProperties }> = ({ children, size = 76, style }) => (
  <div style={{ color: T.white, fontSize: size, fontWeight: 600, letterSpacing: "-0.03em", lineHeight: 1.05, ...style }}>{children}</div>
);
