import {
  motion,
  useTransform,
  useReducedMotion,
  useMotionValue,
  useSpring,
  type MotionValue,
} from 'framer-motion';
import { ArrowRight, Compass, Sparkles } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { TUNNEL_GALLERY_ITEMS } from '../../utils/planetaryImages';
import type { TargetId } from '../../engine/types';

interface TunnelItem {
  src: string;
  title: string;
  subtitle?: string;
  targetId?: TargetId;
  siteId?: string;
}

interface TunnelCardData {
  item: TunnelItem;
  angleCos: number;
  angleSin: number;
  radiusFactorX: number;
  radiusFactorY: number;
  rotationZ: number;
  index: number;
}

const TUNNEL_CARDS: TunnelCardData[] = TUNNEL_GALLERY_ITEMS.map((item, i) => {
  const goldenAngle = i * 137.5 * (Math.PI / 180);
  const radiusFactorX = 0.39 + (i % 3) * 0.08;
  const radiusFactorY = 0.35 + (i % 2) * 0.09;

  return {
    item,
    angleCos: Math.cos(goldenAngle),
    angleSin: Math.sin(goldenAngle),
    radiusFactorX,
    radiusFactorY,
    rotationZ: (i % 2 === 0 ? 1 : -1) * (2.5 + (i % 4) * 1.5),
    index: i,
  };
});

const SPRING_CONFIG = { stiffness: 60, damping: 25, mass: 0.5 };

interface StageDimensions {
  width: number;
  height: number;
  isMobile: boolean;
}

function useCameraParallax(enabled: boolean) {
  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const x = useSpring(rawX, SPRING_CONFIG);
  const y = useSpring(rawY, SPRING_CONFIG);

  useEffect(() => {
    if (!enabled) return;
    const onMove = (e: PointerEvent) => {
      rawX.set((e.clientX / window.innerWidth - 0.5) * 2);
      rawY.set((e.clientY / window.innerHeight - 0.5) * 2);
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, [enabled, rawX, rawY]);

  return { x, y };
}

interface TunnelCardProps {
  card: TunnelCardData;
  progress: MotionValue<number>;
  pointer: { x: MotionValue<number>; y: MotionValue<number> };
  total: number;
  stage: StageDimensions;
  onSelectCard: (item: TunnelItem) => void;
}

function TunnelCard({
  card,
  progress,
  pointer,
  total,
  stage,
  onSelectCard,
}: TunnelCardProps) {
  const staggerSpan = 0.55;
  const start = (card.index / total) * (1 - staggerSpan);
  const end = start + staggerSpan;

  const localProgress = useTransform(progress, [start, end], [0, 1]);

  const farZ = stage.isMobile ? -1050 : -1500;
  const nearZ = stage.isMobile ? 340 : 480;
  const z = useTransform(localProgress, [0, 1], [farZ, nearZ]);

  const opacity = useTransform(localProgress, [0, 0.14, 0.82, 0.98], [0, 1, 1, 0]);

  const cardWidth = stage.isMobile
    ? Math.max(130, Math.min(175, stage.width * 0.36))
    : Math.max(185, Math.min(255, stage.width * 0.175));

  const baseX = card.angleCos * (stage.width * card.radiusFactorX);
  const baseY = card.angleSin * (stage.height * card.radiusFactorY);
  const panStrength = stage.isMobile ? 20 : 42;

  const transform = useTransform(
    [z, pointer.x, pointer.y],
    ([currZ, px, py]: number[]) => {
      const offsetX = baseX - px * panStrength;
      const offsetY = baseY - py * panStrength;
      return `translate3d(calc(-50% + ${offsetX}px), calc(-50% + ${offsetY}px), ${currZ}px) rotateZ(${card.rotationZ}deg)`;
    }
  );

  return (
    <motion.button
      type="button"
      onClick={() => onSelectCard(card.item)}
      style={{
        width: cardWidth,
        transform,
        opacity,
        zIndex: card.index + 1,
      }}
      className="pointer-events-auto absolute left-1/2 top-1/2 aspect-[4/5] will-change-transform select-none cursor-pointer text-left focus:outline-none"
    >
      <div className="group relative h-full w-full overflow-hidden rounded-2xl bg-[#0B101B] shadow-2xl shadow-black/90 ring-1 ring-white/15 transition-all duration-500 hover:ring-cyan-400/80 hover:shadow-cyan-500/25">
        <img
          src={card.item.src}
          alt={card.item.title}
          draggable={false}
          referrerPolicy="no-referrer"
          className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-110"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#04060A]/90 via-[#04060A]/25 to-transparent flex flex-col justify-end p-4 sm:p-5">
          {card.item.subtitle && (
            <span className="font-mono text-[10px] tracking-[0.14em] uppercase text-cyan-300/90 mb-1">
              {card.item.subtitle}
            </span>
          )}
          <span className="font-display text-sm sm:text-base font-semibold tracking-tight text-white">
            {card.item.title}
          </span>
        </div>
      </div>
    </motion.button>
  );
}

interface PerspectiveTunnelHeroProps {
  onEnterWorkspace: (selection?: { targetId?: TargetId; siteId?: string }) => void;
}

export default function PerspectiveTunnelHero({
  onEnterWorkspace,
}: PerspectiveTunnelHeroProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();

  const [stage, setStage] = useState<StageDimensions>({
    width: 1440,
    height: 900,
    isMobile: false,
  });
  const [depthPct, setDepthPct] = useState(18);

  useEffect(() => {
    const updateDimensions = () => {
      setStage({
        width: window.innerWidth,
        height: window.innerHeight,
        isMobile: window.innerWidth < 768,
      });
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // Start at 0.18 so initial cards frame the perimeter cleanly on first paint, wheel/scrub moves 0..1
  const rawProgress = useMotionValue(0.18);
  const smoothProgress = useSpring(rawProgress, {
    stiffness: 80,
    damping: 30,
    restDelta: 0.0001,
  });

  useEffect(() => {
    const unsub = rawProgress.on('change', (v) => {
      setDepthPct(Math.round(v * 100));
    });
    return () => unsub();
  }, [rawProgress]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const current = rawProgress.get();
      const delta = e.deltaY * 0.0008;
      const next = Math.min(1, Math.max(0, current + delta));
      rawProgress.set(next);
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [rawProgress]);

  const pointer = useCameraParallax(!reduce);

  const titleScale = useTransform(smoothProgress, [0, 0.5, 1], [0.85, 1, 1.25]);
  const titleOpacity = useTransform(smoothProgress, [0, 0.08, 0.88, 1], [0.55, 1, 1, 0.15]);
  const promptOpacity = useTransform(smoothProgress, [0, 0.25], [1, 0]);

  return (
    <div
      ref={containerRef}
      className="relative h-[100svh] w-full overflow-hidden bg-[#04060A] text-white select-none flex items-center justify-center"
      style={{
        perspective: stage.isMobile ? '900px' : '1200px',
        transformStyle: 'preserve-3d',
      }}
    >
      {/* Immersive Spatial Grid & Atmospheric Radial Glow */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:28px_28px] [mask-image:radial-gradient(ellipse_70%_70%_at_50%_50%,#000_60%,transparent_100%)] opacity-60" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(6,182,212,0.16)_0%,rgba(59,130,246,0.06)_38%,transparent_72%)]" />

      {/* Depth Ring Guides */}
      <div className="pointer-events-none absolute h-[48vmin] w-[48vmin] rounded-full border border-cyan-400/15" />
      <div className="pointer-events-none absolute h-[76vmin] w-[76vmin] rounded-full border border-dashed border-white/10" />

      {/* Top Spatial Header */}
      <div className="absolute top-5 left-5 right-5 z-30 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-400/30 flex items-center justify-center">
            <Compass className="w-4 h-4 text-cyan-400" />
          </div>
          <div>
            <div className="font-display text-sm font-bold tracking-wider text-white">
              TERRA-9
            </div>
            <div className="font-mono text-[10px] tracking-[0.14em] text-slate-400 uppercase">
              9X MOTIONS · NASA SPACE APPS 2026
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onEnterWorkspace()}
          className="px-4 py-2 rounded-lg bg-white/10 hover:bg-cyan-400 hover:text-slate-950 border border-white/15 text-xs font-medium tracking-wide backdrop-blur-md transition-all duration-200 inline-flex items-center gap-2 cursor-pointer"
        >
          <span>Skip to Mission Control</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Central Anchor Typography */}
      <motion.div
        style={{ scale: titleScale, opacity: titleOpacity }}
        className="relative z-20 flex flex-col items-center text-center px-6 max-w-2xl pointer-events-none"
      >
        {/* Seamless obsidian radial veil preserves contrast while 3D terrain cards pass behind */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -inset-x-24 -inset-y-14 -z-10 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(4,6,10,0.92)_0%,rgba(4,6,10,0.74)_48%,transparent_78%)] blur-xl"
        />
        <p className="inline-flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.35em] text-cyan-400 mb-4">
          <Sparkles className="w-3.5 h-3.5" />
          Earth Analog Intelligence System
        </p>
        <h1 className="font-display text-5xl sm:text-7xl md:text-8xl font-bold tracking-tighter leading-[0.9] bg-gradient-to-b from-white via-slate-100 to-slate-400/50 bg-clip-text text-transparent">
          BEYOND
          <br />
          EARTH.
        </h1>
        <p className="mt-5 max-w-[44ch] text-sm sm:text-base font-light text-slate-200 leading-relaxed drop-shadow-[0_2px_12px_rgba(4,6,10,0.9)]">
          Grounded in Data. Driven by Discovery. Scroll your wheel or trackpad to fly through
          planetary targets and terrestrial analog terrains, or enter Mission Control directly.
        </p>

        <div className="mt-7 pointer-events-auto flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => onEnterWorkspace()}
            className="px-6 py-3 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-display text-sm font-semibold tracking-wide shadow-lg shadow-cyan-500/25 transition-all duration-200 inline-flex items-center gap-2 cursor-pointer"
          >
            <span>Enter Mission Control</span>
            <ArrowRight className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              const next = rawProgress.get() > 0.78 ? 0.18 : Math.min(1, rawProgress.get() + 0.22);
              rawProgress.set(next);
            }}
            className="px-5 py-3 rounded-xl bg-[#0B101B]/85 hover:bg-white/[0.12] border border-white/15 text-slate-200 font-mono text-xs uppercase tracking-wider backdrop-blur-md transition-all duration-200 cursor-pointer"
          >
            Advance Corridor ({depthPct}%)
          </button>
        </div>
      </motion.div>

      {/* Scroll Prompt */}
      <motion.div
        style={{ opacity: promptOpacity }}
        className="pointer-events-none absolute bottom-7 z-20 flex flex-col items-center gap-2 text-[11px] font-mono uppercase tracking-[0.28em] text-slate-400"
      >
        <span>Scroll to Fly Corridor · Click Any Terrain to Inspect</span>
        <div className="h-6 w-px bg-gradient-to-b from-cyan-400 to-transparent" />
      </motion.div>

      {/* 3D Z-Space Plane */}
      <div
        className="absolute inset-0 z-10 pointer-events-none"
        style={{ transformStyle: 'preserve-3d' }}
      >
        {TUNNEL_CARDS.map((card, i) => (
          <TunnelCard
            key={i}
            card={card}
            progress={smoothProgress}
            pointer={pointer}
            total={TUNNEL_CARDS.length}
            stage={stage}
            onSelectCard={(item) =>
              onEnterWorkspace({ targetId: item.targetId, siteId: item.siteId })
            }
          />
        ))}
      </div>
    </div>
  );
}
