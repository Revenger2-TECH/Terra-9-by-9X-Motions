export type GlassSettings = {
  blur: number;
  opacity: number;
  saturation: number;
  tint: string;
  edge: number;
};

export const DEFAULT_GLASS_SETTINGS: GlassSettings = {
  blur: 16,
  opacity: 0.78,
  saturation: 1.25,
  tint: '#0B101B',
  edge: 0.4,
};

export const GLASS_PRESETS: Array<{ name: string; value: Partial<GlassSettings> }> = [
  {
    name: 'Clear',
    value: { blur: 8, opacity: 0.45, saturation: 1.15, edge: 0.75 },
  },
  {
    name: 'Frosted',
    value: DEFAULT_GLASS_SETTINGS,
  },
  {
    name: 'Solid',
    value: { blur: 28, opacity: 0.94, saturation: 1.05, edge: 0.25 },
  },
];

export function bounded(value: number, min: number, max: number, fallback: number): number {
  return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}

export function normalizeGlassSettings(v: Partial<GlassSettings>): GlassSettings {
  return {
    blur: bounded(v.blur ?? DEFAULT_GLASS_SETTINGS.blur, 0, 40, DEFAULT_GLASS_SETTINGS.blur),
    opacity: bounded(
      v.opacity ?? DEFAULT_GLASS_SETTINGS.opacity,
      0.08,
      0.95,
      DEFAULT_GLASS_SETTINGS.opacity
    ),
    saturation: bounded(
      v.saturation ?? DEFAULT_GLASS_SETTINGS.saturation,
      0.5,
      2,
      DEFAULT_GLASS_SETTINGS.saturation
    ),
    edge: bounded(v.edge ?? DEFAULT_GLASS_SETTINGS.edge, 0, 1, DEFAULT_GLASS_SETTINGS.edge),
    tint: /^#[0-9a-f]{6}$/i.test(v.tint ?? '')
      ? v.tint!
      : DEFAULT_GLASS_SETTINGS.tint,
  };
}
