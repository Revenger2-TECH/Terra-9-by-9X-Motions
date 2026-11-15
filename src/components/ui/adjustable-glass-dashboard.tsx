import { useEffect, useId, type CSSProperties, type RefObject } from 'react';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';
import { Layers, Settings2, X } from 'lucide-react';
import {
  DEFAULT_GLASS_SETTINGS,
  GLASS_PRESETS,
  normalizeGlassSettings,
  type GlassSettings,
} from './glassSettings';

gsap.registerPlugin(useGSAP);

export type { GlassSettings } from './glassSettings';
export { DEFAULT_GLASS_SETTINGS, GLASS_PRESETS, normalizeGlassSettings } from './glassSettings';

/**
 * GSAP staggered blur-rise reveal animation from adjustable-glass-dashboard.
 * Animates all `.gw-reveal` panels inside `contentRef` whenever `dependencies` change,
 * respecting `prefers-reduced-motion`.
 */
export function useSubpageReveal(
  scopeRef: RefObject<HTMLElement | null>,
  contentRef: RefObject<HTMLElement | null>,
  dependencies: unknown[]
) {
  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        const panels = contentRef.current?.querySelectorAll('.gw-reveal');
        if (!panels?.length) return;
        gsap.fromTo(
          panels,
          { y: 12, opacity: 0.45, filter: 'blur(3px)' },
          {
            y: 0,
            opacity: 1,
            filter: 'blur(0px)',
            duration: 0.48,
            stagger: 0.045,
            ease: 'power3.out',
            clearProps: 'transform,opacity,filter',
          }
        );
      });
      return () => mm.revert();
    },
    { scope: scopeRef, dependencies, revertOnUpdate: true }
  );
}

export function glassToCssVariables(settings: GlassSettings): CSSProperties {
  return {
    '--gw-blur': `${settings.blur}px`,
    '--gw-opacity': settings.opacity,
    '--gw-saturation': settings.saturation,
    '--gw-tint': settings.tint,
    '--gw-edge': settings.edge,
  } as CSSProperties;
}

interface GlassMaterialPopoverProps {
  open: boolean;
  material: GlassSettings;
  onChange: (next: GlassSettings) => void;
  onClose: () => void;
  triggerRef?: RefObject<HTMLButtonElement | null>;
}

export function GlassMaterialPopover({
  open,
  material,
  onChange,
  onClose,
  triggerRef,
}: GlassMaterialPopoverProps) {
  const id = useId().replace(/:/g, '');

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        triggerRef?.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, triggerRef]);

  if (!open) return null;

  const update = (patch: Partial<GlassSettings>) => {
    onChange(normalizeGlassSettings({ ...material, ...patch }));
  };

  return (
    <aside
      id={`${id}-material`}
      aria-label="Glass appearance"
      className="fixed right-4 lg:right-7 top-16 z-50 w-[300px] max-h-[calc(100svh-84px)] overflow-y-auto rounded-2xl bg-[#0B101B]/95 backdrop-blur-2xl border border-white/15 shadow-2xl shadow-black/80 p-5 text-slate-100"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <Settings2 className="w-4 h-4 text-cyan-400" aria-hidden="true" />
          <h2 className="font-display text-sm font-semibold text-white">Glass appearance</h2>
        </div>
        <button
          type="button"
          aria-label="Close glass settings"
          onClick={() => {
            onClose();
            triggerRef?.current?.focus();
          }}
          className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/[0.08] cursor-pointer"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>

      <p className="text-[11px] text-slate-400 mt-1.5 mb-3.5">
        Adjust the glass material across all mission modules.
      </p>

      {/* Live material sample */}
      <div
        aria-hidden="true"
        className="t9-glass-panel h-20 rounded-xl border flex items-center justify-center gap-2.5 text-xs text-slate-200 mb-4"
      >
        <Layers className="w-5 h-5 text-cyan-400" strokeWidth={1.3} />
        <span className="font-mono text-[11px]">Live material preview</span>
      </div>

      <div className="grid grid-cols-3 gap-1.5 mb-4" aria-label="Glass presets">
        {GLASS_PRESETS.map((preset) => (
          <button
            key={preset.name}
            type="button"
            onClick={() => update(preset.value)}
            className="rounded-lg border border-white/10 bg-white/[0.04] hover:bg-white/[0.1] hover:border-cyan-400/50 py-1.5 font-mono text-[11px] text-slate-200 cursor-pointer transition-colors"
          >
            {preset.name}
          </button>
        ))}
      </div>

      <div className="space-y-3.5">
        {[
          {
            key: 'blur' as const,
            label: 'Blur',
            min: 0,
            max: 40,
            step: 1,
            display: `${Math.round(material.blur)} px`,
          },
          {
            key: 'opacity' as const,
            label: 'Opacity',
            min: 0.08,
            max: 0.95,
            step: 0.01,
            display: `${Math.round(material.opacity * 100)}%`,
          },
          {
            key: 'saturation' as const,
            label: 'Saturation',
            min: 0.5,
            max: 2,
            step: 0.05,
            display: `${Math.round(material.saturation * 100)}%`,
          },
          {
            key: 'edge' as const,
            label: 'Edge light',
            min: 0,
            max: 1,
            step: 0.05,
            display: `${Math.round(material.edge * 100)}%`,
          },
        ].map((ctrl) => (
          <label key={ctrl.key} className="block space-y-1">
            <span className="flex items-center justify-between font-mono text-[11px] text-slate-300">
              <span>{ctrl.label}</span>
              <output className="text-cyan-300 tabular-nums">{ctrl.display}</output>
            </span>
            <input
              type="range"
              aria-label={ctrl.label}
              min={ctrl.min}
              max={ctrl.max}
              step={ctrl.step}
              value={material[ctrl.key]}
              onChange={(e) => update({ [ctrl.key]: Number(e.target.value) })}
              className="w-full accent-cyan-400 cursor-pointer"
            />
          </label>
        ))}

        <label className="flex items-center justify-between font-mono text-[11px] text-slate-300 pt-1">
          <span>Glass tint</span>
          <input
            type="color"
            aria-label="Glass tint"
            value={material.tint}
            onChange={(e) => update({ tint: e.target.value })}
            className="h-7 w-10 p-0.5 rounded-md bg-transparent border border-white/15 cursor-pointer"
          />
        </label>
      </div>

      <button
        type="button"
        onClick={() => onChange(DEFAULT_GLASS_SETTINGS)}
        className="w-full mt-4 py-2 rounded-lg border border-white/10 hover:bg-white/[0.08] font-mono text-[11px] text-slate-300 cursor-pointer transition-colors"
      >
        Reset appearance
      </button>
    </aside>
  );
}
