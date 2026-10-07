import { createVuetify, type VuetifyOptions } from "vuetify";
import * as components from "vuetify/components";
import * as directives from "vuetify/directives";
import { aliases, mdi } from "vuetify/iconsets/mdi";
import { mix, shiftHue } from "./color.js";

const STORAGE_KEY = "homelab-theme";

export type HomelabThemeName = "homelabLight" | "homelabDark";

const isHomelabThemeName = (value: string | null): value is HomelabThemeName =>
  value === "homelabLight" || value === "homelabDark";

// Reads a saved preference first (set by AppShell's theme toggle), falling
// back to the OS/browser preference, then dark - matches my-moments'
// light/dark bootstrap so every homelab PWA remembers a user's choice
// per-device rather than re-deriving it from system settings every load.
export const preferredHomelabTheme = (): HomelabThemeName => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (isHomelabThemeName(stored)) return stored;
  } catch {
    // localStorage unavailable (private browsing, disabled storage, ...) - fall through
  }
  if (typeof matchMedia === "function" && matchMedia("(prefers-color-scheme: light)").matches) {
    return "homelabLight";
  }
  return "homelabDark";
};

export const persistHomelabTheme = (name: HomelabThemeName): void => {
  try {
    localStorage.setItem(STORAGE_KEY, name);
  } catch {
    // theme just won't persist across reloads
  }
};

// One accent per app, so the apps look related but each is recognisable.
// Pick yours from here (`createHomelabVuetify({ accent: homelabAccents.coral })`)
// and add a row for a new app. Tuned with tools/theme-tuner.html.
export const homelabAccents = {
  green: "#3fae6a",
  coral: "#ff6b6b",
  blue: "#4a9eff",
  amber: "#e0a030",
  teal: "#2e9d86",
  violet: "#8a6cff",
} as const;

// The background glow AppShell paints behind every page: a main spot of the
// accent in the top-left corner and a weaker one of `glow` (the accent's
// +30deg neighbour) top-right. Sized in vmax so it covers the same share of
// a 27" monitor as of a phone. Light mode uses the same glow, fainter.
export const homelabGlow = {
  main: 0.16,
  second: 0.1,
  sizeVmax: 60,
  secondHueShift: 30,
  lightModeFactor: 0.6,
};

export const glowBackground = (dark: boolean): string => {
  const factor = dark ? 1 : homelabGlow.lightModeFactor;
  const size = homelabGlow.sizeVmax;
  const mainAlpha = String(+(homelabGlow.main * factor).toFixed(3));
  const secondAlpha = String(+(homelabGlow.second * factor).toFixed(3));
  const secondSize = String(Math.round(size * 0.85));
  return [
    `radial-gradient(circle at 8% -10%, rgba(var(--v-theme-primary), ${mainAlpha}), transparent ${String(size)}vmax)`,
    `radial-gradient(circle at 100% 10%, rgba(var(--v-theme-glow), ${secondAlpha}), transparent ${secondSize}vmax)`,
    "rgb(var(--v-theme-background))",
  ].join(", ");
};

// Theme v2.1 (tuned by the maintainer in
// tools/theme-tuner.html after v2 read as too green on a large monitor):
// background and surfaces are neutral (the background carries 0.5% of the
// accent, just enough not to look default); the accent shows in the app bar,
// the controls and AppShell's glow instead. The app bar runs from the accent
// to its +40deg neighbour, both darkened 60% towards black. The semantic
// colours are tuned per theme so tonal chips/alerts stay readable.
export const themeColors = (dark: boolean, accent: string): Record<string, string> => {
  const secondary = shiftHue(accent, 40);
  const shared = {
    primary: accent,
    secondary,
    glow: shiftHue(accent, homelabGlow.secondHueShift),
    "app-bar": mix("#000000", accent, 0.6),
    "app-bar-end": mix("#000000", secondary, 0.6),
  };
  return dark
    ? {
        ...shared,
        background: mix(accent, "#0e0f13", 0.005),
        surface: "#1a1b21",
        "surface-bright": "#2c2d35",
        "surface-light": "#2a2b33",
        "surface-variant": "#30313a",
        success: "#5cc281",
        warning: "#ffb74d",
        error: "#ff6b6b",
        info: "#5ab8f0",
      }
    : {
        ...shared,
        background: mix(accent, "#f4f5f8", 0.005),
        surface: "#ffffff",
        "surface-bright": "#ffffff",
        "surface-light": "#eef0f5",
        "surface-variant": "#e4e6ee",
        success: "#2e7d32",
        warning: "#a35400",
        error: "#c62828",
        info: "#0b6fb8",
      };
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

// Merges `overrides` into `base` key by key, so overriding one component
// default or one theme colour keeps the rest. Arrays and other values replace.
export const mergeDeep = <T extends Record<string, unknown>>(
  base: T,
  overrides: Record<string, unknown> = {},
): T => {
  const merged: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(overrides)) {
    const current = merged[key];
    merged[key] =
      isPlainObject(value) && isPlainObject(current) ? mergeDeep(current, value) : value;
  }
  return merged as T;
};

// Component defaults that give every app the v2 look without per-app CSS.
// The app bar gradient runs between the two darkened `app-bar` colours; it
// goes through `style` so an app can drop it with
// `overrides.defaults.VAppBar.style` and keep the solid `app-bar` colour.
export const homelabComponentDefaults = {
  VAppBar: {
    color: "app-bar",
    elevation: 2,
    style:
      "background-image: linear-gradient(120deg, rgb(var(--v-theme-app-bar)) 0%, rgb(var(--v-theme-app-bar-end)) 100%)",
  },
  VCard: { variant: "elevated", elevation: 1, rounded: "lg" },
  VBtn: { rounded: "lg", class: "text-none", style: "letter-spacing: normal" },
  VChip: { variant: "tonal", rounded: "lg" },
  VAlert: { variant: "tonal", rounded: "lg", border: "start" },
  VSnackbar: { rounded: "lg", elevation: 6 },
  VList: { color: "primary" },
  VTextField: { variant: "outlined", density: "comfortable", color: "primary" },
  VTextarea: { variant: "outlined", density: "comfortable", color: "primary" },
  VSelect: { variant: "outlined", density: "comfortable", color: "primary" },
  VAutocomplete: { variant: "outlined", density: "comfortable", color: "primary" },
  VCombobox: { variant: "outlined", density: "comfortable", color: "primary" },
  VSwitch: { color: "primary", inset: true },
  VCheckbox: { color: "primary" },
  VProgressLinear: { color: "primary", rounded: true },
  VProgressCircular: { color: "primary" },
};

export interface HomelabVuetifyOptions {
  // Each service's own primary/brand color - shared structure (layout,
  // light/dark mechanics, typography), not a shared brand identity. Falls
  // back to a neutral violet so a service that doesn't pass one still gets
  // a reasonable default.
  accent?: string;
  overrides?: VuetifyOptions;
}

// Common defaults for every homelab PWA - shared light/dark theme mechanics,
// icon setup, and component defaults, so each service doesn't re-derive
// them. A service can override anything here via `overrides` (deep-merged,
// so one changed default keeps the others), or pick its own identity via
// `accent`.
export const createHomelabVuetify = (
  options: HomelabVuetifyOptions = {},
): ReturnType<typeof createVuetify> => {
  const accent = options.accent ?? "#7c5cff";

  const base: VuetifyOptions = {
    components,
    directives,
    theme: {
      defaultTheme: preferredHomelabTheme(),
      themes: {
        homelabLight: { dark: false, colors: themeColors(false, accent) },
        homelabDark: { dark: true, colors: themeColors(true, accent) },
      },
    },
    icons: {
      defaultSet: "mdi",
      aliases,
      sets: { mdi },
    },
    defaults: homelabComponentDefaults,
  };

  return createVuetify(
    mergeDeep(base as Record<string, unknown>, options.overrides as Record<string, unknown>),
  );
};
