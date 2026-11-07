import { createTheme, defaultLightTheme, type Theme, type ThemeProps } from '@openuidev/react-ui';

/**
 * Inkmark — the extension's design system.
 *
 * Idea: a reader's notebook. Paper and ink stay fixed per light/dark mode; the user picks the
 * "pen" (accent) and the "highlighter" (marker). Everything derives from those two colors:
 * app chrome (CSS variables), OpenUI components (ThemeProvider tokens), charts and Pele diagrams.
 */

export type CornerStyle = 'soft' | 'square';
export type ReadingFont = 'serif' | 'sans';
export type ColorMode = 'light' | 'dark' | 'system';

export interface Appearance {
  /** Preset id, or "custom" to use `accent` and `marker`. */
  preset: string;
  accent: string;
  marker: string;
  corners: CornerStyle;
  readingFont: ReadingFont;
}

export interface Preset {
  id: string;
  name: string;
  /** Pen color (light mode; dark mode is derived). */
  accent: string;
  /** Highlighter color. */
  marker: string;
}

export const PRESETS: Preset[] = [
  { id: 'inkmark', name: 'Inkmark', accent: '#2E4BD6', marker: '#FFE45C' },
  { id: 'tide', name: 'Tide', accent: '#0B7A83', marker: '#A6F0E6' },
  { id: 'grove', name: 'Grove', accent: '#2E7D46', marker: '#DDF27C' },
  { id: 'orchid', name: 'Orchid', accent: '#A3328F', marker: '#FFC9EC' },
  { id: 'graphite', name: 'Graphite', accent: '#39404F', marker: '#FFD27A' },
];

export const DEFAULT_APPEARANCE: Appearance = {
  preset: 'inkmark',
  accent: PRESETS[0]!.accent,
  marker: PRESETS[0]!.marker,
  corners: 'soft',
  readingFont: 'serif',
};

const SANS = '"Bricolage Grotesque Variable", ui-sans-serif, system-ui, sans-serif';
const SERIF = '"Source Serif 4 Variable", Georgia, "Times New Roman", serif';

// ── Color helpers ──────────────────────────────────────────────────────────────

const HEX = /^#?([0-9a-f]{6})$/i;

function toRgb(hex: string): [number, number, number] {
  const m = HEX.exec(hex.trim());
  const n = parseInt(m ? m[1]! : '2E4BD6', 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const toHex = (rgb: number[]) =>
  '#' +
  rgb
    .map((v) =>
      Math.round(Math.max(0, Math.min(255, v)))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('');

/** Mixes `hex` toward `target` by `amount` (0..1). */
function mix(hex: string, target: string, amount: number) {
  const a = toRgb(hex);
  const b = toRgb(target);
  return toHex(a.map((v, i) => v + (b[i]! - v) * amount));
}

/** WCAG relative luminance. */
function luminance(hex: string) {
  const [r, g, b] = toRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

export const isHex = (v: string) => HEX.test(v.trim());

// ── Resolution ─────────────────────────────────────────────────────────────────

export interface ResolvedPalette {
  accent: string;
  accentHover: string;
  accentSoft: string;
  onAccent: string;
  marker: string;
  charts: string[];
}

/** Supporting chart hues, picked to stay distinct next to any accent. */
const CHART_SUPPORT_LIGHT = ['#0F9D8A', '#E59A1A', '#7C4DDB', '#E2555F', '#5E6880'];
const CHART_SUPPORT_DARK = ['#3CC8B4', '#F2B54A', '#A784F2', '#F27C84', '#9AA3B8'];

export function resolvePalette(a: Appearance, dark: boolean): ResolvedPalette {
  const preset = PRESETS.find((p) => p.id === a.preset);
  const baseAccent = preset?.accent ?? (isHex(a.accent) ? a.accent : DEFAULT_APPEARANCE.accent);
  const baseMarker = preset?.marker ?? (isHex(a.marker) ? a.marker : DEFAULT_APPEARANCE.marker);

  // Dark mode: lift the pen toward white until it reads on the dark paper.
  let accent = baseAccent;
  if (dark) for (let i = 0; i < 6 && luminance(accent) < 0.22; i++) accent = mix(accent, '#ffffff', 0.18);

  const paper = dark ? '#1B202B' : '#FFFFFF';
  return {
    accent,
    accentHover: mix(accent, dark ? '#ffffff' : '#000000', 0.12),
    accentSoft: mix(accent, paper, dark ? 0.82 : 0.9),
    onAccent: luminance(accent) > 0.45 ? '#141821' : '#FFFFFF',
    // A highlighter on dark paper is a translucent band, not a solid block.
    marker: dark ? `${baseMarker}6B` : baseMarker,
    charts: [accent, ...(dark ? CHART_SUPPORT_DARK : CHART_SUPPORT_LIGHT)],
  };
}

/** CSS variables for the app chrome and custom components (set on the app root). */
export function appearanceVars(a: Appearance, dark: boolean): Record<string, string> {
  const p = resolvePalette(a, dark);
  const square = a.corners === 'square';
  return {
    '--accent': p.accent,
    '--accent-hover': p.accentHover,
    '--accent-soft': p.accentSoft,
    '--on-accent': p.onAccent,
    '--marker': p.marker,
    '--font-reading': a.readingFont === 'sans' ? SANS : SERIF,
    '--r-sm': square ? '2px' : '8px',
    '--r-md': square ? '3px' : '12px',
    '--r-lg': square ? '4px' : '16px',
    '--r-pill': square ? '4px' : '999px',
    ...Object.fromEntries(p.charts.map((c, i) => [`--pele-series-${i + 1}`, c])),
  };
}

// ── OpenUI theme ───────────────────────────────────────────────────────────────

/**
 * OpenUI composes shorthand text tokens (textBodyDefault = '400 16px/1.5 "Inter", sans-serif')
 * from its default font, so overriding fontBody alone does not reach them. Rebuild each one.
 */
function typographyTokens(reading: string): Partial<Theme> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(defaultLightTheme)) {
    if (typeof value !== 'string' || !key.startsWith('text') || !value.includes('"Inter"')) continue;
    out[key] = value.replace(/"Inter",\s*sans-serif/, key.startsWith('textBody') ? reading : SANS);
  }
  return out as Partial<Theme>;
}

const palettes = (colors: string[]) => ({
  defaultChartPalette: colors,
  barChartPalette: colors,
  lineChartPalette: colors,
  areaChartPalette: colors,
  pieChartPalette: colors,
  radarChartPalette: colors,
  radialChartPalette: colors,
  horizontalBarChartPalette: colors,
});

/** ThemeProvider props for the generated UI, derived from the same appearance. */
export function buildOpenUITheme(a: Appearance): Pick<ThemeProps, 'lightTheme' | 'darkTheme'> {
  const reading = a.readingFont === 'sans' ? SANS : SERIF;
  const square = a.corners === 'square';
  const shared = {
    ...typographyTokens(reading),
    fontBody: reading,
    fontHeading: SANS,
    fontLabel: SANS,
    fontNumbers: SANS,
    radiusS: square ? '2px' : '6px',
    radiusM: square ? '3px' : '10px',
    radiusL: square ? '4px' : '14px',
    radiusXl: square ? '4px' : '18px',
  };
  const light = resolvePalette(a, false);
  const dark = resolvePalette(a, true);

  return {
    lightTheme: createTheme({
      ...shared,
      ...palettes(light.charts),
      background: '#F5F7FB',
      foreground: '#FFFFFF',
      textNeutralPrimary: '#1A2236',
      textNeutralSecondary: '#5E6880',
      textNeutralTertiary: '#8A93A8',
      textNeutralLink: light.accent,
      textBrand: light.accent,
      interactiveAccentDefault: light.accent,
      interactiveAccentHover: light.accentHover,
      interactiveAccentPressed: light.accentHover,
      borderDefault: '#E3E7F0',
      borderAccent: light.accent,
      highlightSubtle: light.accentSoft,
      shadowS: '0 1px 2px rgb(26 34 54 / 0.06)',
      shadowM: '0 6px 18px -8px rgb(26 34 54 / 0.18)',
    }),
    darkTheme: createTheme({
      ...shared,
      ...palettes(dark.charts),
      background: '#141821',
      foreground: '#1B202B',
      textNeutralPrimary: '#E8EBF3',
      textNeutralSecondary: '#A2AABD',
      textNeutralTertiary: '#7A8399',
      textNeutralLink: dark.accent,
      textBrand: dark.accent,
      interactiveAccentDefault: dark.accent,
      interactiveAccentHover: dark.accentHover,
      interactiveAccentPressed: dark.accentHover,
      borderDefault: '#2A3141',
      borderAccent: dark.accent,
      highlightSubtle: dark.accentSoft,
      shadowS: '0 1px 2px rgb(0 0 0 / 0.3)',
      shadowM: '0 8px 22px -10px rgb(0 0 0 / 0.55)',
    }),
  };
}
