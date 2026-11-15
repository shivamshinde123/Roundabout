import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { loadFont as loadMono } from "@remotion/google-fonts/JetBrainsMono";

const inter = loadInter("normal", { weights: ["400", "500", "600", "700"], subsets: ["latin"] });
const mono = loadMono("normal", { weights: ["400", "500"], subsets: ["latin"] });

// The app's own tokens (Docs/design-system.md, D-31, D-39): Linear-style layered dark.
export const T = {
  shell: "#0f0f11",
  panel: "#17171a",
  card: "#1d1d21",
  column: "#1b1b1e",
  popover: "#222226",
  hover: "#26262b",
  line: "#2a2a2f",
  lineStrong: "#303036",
  text: "#e6e6e8",
  soft: "#b4b4bc",
  muted: "#8d8d95",
  white: "#ffffff",
  indigo: "#5e6ad2",
  indigoSoft: "#a5adf0",
  coral: "#eb5757",
  yellow: "#f2c94c",
  green: "#4cb782",
  orange: "#f2994a",
  teal: "#26b5ce",
  violet: "#bb87fc",
  ui: `${inter.fontFamily}, "Segoe UI", sans-serif`,
  mono: `${mono.fontFamily}, ui-monospace, monospace`,
} as const;

/** Indigo glow behind hero moments. */
export const GLOW = "radial-gradient(50% 55% at 50% 42%, rgba(94,106,210,.28), transparent 70%)";
/** The default scene background: the shell with a faint indigo lift at the top. */
export const BACKDROP = `radial-gradient(70% 60% at 50% -10%, rgba(94,106,210,.16), transparent 70%), ${T.shell}`;
