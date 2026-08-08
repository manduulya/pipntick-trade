import type { Theme } from "./theme";

export type ChartPalette = {
  /** CartesianGrid stroke, and the AreaChart Tooltip's cursor line. */
  gridStroke: string;
  /** XAxis/YAxis tick label color. */
  axisTick: string;
  /** Area line stroke, its gradient fill's stop color, and the active-point dot's fill. */
  areaStroke: string;
  /** Active-point dot's stroke — matches the page background so the dot reads as "cut out" of the line. */
  areaActiveDotStroke: string;
  /** BarChart Tooltip's cursor highlight — a translucent overlay, needs to flip white/black per theme. */
  barCursorFill: string;
  positive: string;
  negative: string;
};

// Recharts renders these as literal SVG presentation attributes (stroke="...", fill="...") on
// the <path>/<line>/<text> elements it draws itself — unlike a normal DOM element's `style` prop,
// bare SVG attributes don't resolve CSS custom properties (var(--x)), so this is a literal hex
// mirror of the relevant globals.css tokens, kept in sync by hand (only ~7 values, not worth
// generating). Used only by dashboard/performance/page.tsx, the app's one Recharts usage site —
// the tooltip's own content renders as a plain HTML div, so it uses var(--x) directly instead
// and doesn't need anything from here.
export const CHART_PALETTES: Record<Theme, ChartPalette> = {
  dark: {
    gridStroke: "#1a2d4a",
    axisTick: "#4a5d70",
    areaStroke: "#7bc13b",
    areaActiveDotStroke: "#05090f",
    barCursorFill: "rgba(255,255,255,0.03)",
    positive: "#7bc13b",
    negative: "#e05252",
  },
  light: {
    gridStroke: "#dbe2ea",
    axisTick: "#6b7785",
    areaStroke: "#458019",
    areaActiveDotStroke: "#f7f9fc",
    barCursorFill: "rgba(0,0,0,0.04)",
    positive: "#458019",
    negative: "#c0392b",
  },
};
