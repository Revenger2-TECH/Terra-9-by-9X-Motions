import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Crosshair, Layers, Minus, Plus, RotateCcw } from 'lucide-react';
import type { PlanetaryTarget, TargetId } from '../engine/types';
import { PLANETARY_VISUAL_REFS } from '../utils/planetaryImages';
import { ModuleCard, StatusIndicator } from './TelemetryPrimitives';

type ExplorerLayer =
  | 'VISUAL_REF'
  | 'ELEVATION_PROFILE'
  | 'SLOPE_PROFILE'
  | 'THERMAL_PROFILE'
  | 'HYPERSPECTRAL_BAND';

interface PlanetaryExplorerViewProps {
  targets: PlanetaryTarget[];
  activeTargetId: TargetId;
  onSelectTarget: (targetId: TargetId) => void;
  onNavigateDiscovery: () => void;
}

const GRID_SIZE = 72;

function generateCraterGrid(
  targetId: TargetId,
  layer: 'ELEVATION_PROFILE' | 'SLOPE_PROFILE' | 'THERMAL_PROFILE'
): { matrix: number[][]; min: number; max: number; unit: string } {
  const elevMatrix: number[][] = [];
  const half = GRID_SIZE / 2;

  for (let y = 0; y < GRID_SIZE; y++) {
    const row: number[] = [];
    for (let x = 0; x < GRID_SIZE; x++) {
      const nx = (x - half) / half;
      const ny = (y - half) / half;
      const r = Math.sqrt(nx * nx + ny * ny);
      const angle = Math.atan2(ny, nx);

      if (targetId === 'shackleton') {
        const rimRadius = 0.52;
        const rimWidth = 0.14;
        const bowl =
          r < rimRadius
            ? -4200 + 5600 * Math.pow(r / rimRadius, 2.3)
            : 1400 * Math.exp(-Math.pow((r - rimRadius) / rimWidth, 2)) - 400 * (r - rimRadius);
        const microRelief =
          120 * Math.sin(nx * 11 + ny * 7) + 65 * Math.cos(angle * 5 + r * 9);
        row.push(bowl + microRelief);
      } else {
        const rimRadius = 0.65;
        let elev =
          r < rimRadius
            ? -2580 + 620 * Math.pow(r / rimRadius, 3.4)
            : -1960 - 180 * Math.max(0, r - rimRadius);
        const dx = nx + 0.34;
        const dy = ny + 0.28;
        const deltaDist = Math.sqrt(dx * dx + dy * dy);
        if (deltaDist < 0.35 && nx < 0.05 && ny < 0.1) {
          elev += 195 * Math.exp(-deltaDist * 5.5) * (1 + 0.25 * Math.sin(angle * 9));
        }
        elev += 35 * Math.sin(nx * 14) * Math.cos(ny * 13);
        row.push(elev);
      }
    }
    elevMatrix.push(row);
  }

  if (layer === 'ELEVATION_PROFILE') {
    const flat = elevMatrix.flat();
    return { matrix: elevMatrix, min: Math.min(...flat), max: Math.max(...flat), unit: 'm' };
  }

  if (layer === 'SLOPE_PROFILE') {
    const cellMeters = targetId === 'shackleton' ? 580 : 1200;
    const slopeMatrix: number[][] = [];
    for (let y = 0; y < GRID_SIZE; y++) {
      const row: number[] = [];
      for (let x = 0; x < GRID_SIZE; x++) {
        const xm = Math.max(0, x - 1);
        const xp = Math.min(GRID_SIZE - 1, x + 1);
        const ym = Math.max(0, y - 1);
        const yp = Math.min(GRID_SIZE - 1, y + 1);
        const dzdx = (elevMatrix[y][xp] - elevMatrix[y][xm]) / (2 * cellMeters);
        const dzdy = (elevMatrix[yp][x] - elevMatrix[ym][x]) / (2 * cellMeters);
        const slopeDeg = (Math.atan(Math.sqrt(dzdx * dzdx + dzdy * dzdy)) * 180) / Math.PI;
        row.push(Math.min(42, slopeDeg));
      }
      slopeMatrix.push(row);
    }
    const flat = slopeMatrix.flat();
    return { matrix: slopeMatrix, min: Math.min(...flat), max: Math.max(...flat), unit: 'deg' };
  }

  const thermalMatrix: number[][] = [];
  for (let y = 0; y < GRID_SIZE; y++) {
    const row: number[] = [];
    for (let x = 0; x < GRID_SIZE; x++) {
      const nx = (x - half) / half;
      const ny = (y - half) / half;
      const r = Math.sqrt(nx * nx + ny * ny);
      if (targetId === 'shackleton') {
        const temp =
          r < 0.46 ? 42 + 65 * Math.pow(r / 0.46, 2) : 135 + 105 * Math.max(0, nx * 0.5 + 0.5);
        row.push(temp);
      } else {
        const temp = 212 + 18 * Math.sin(nx * 4 + ny * 3) + (r > 0.6 ? 12 : -4);
        row.push(temp);
      }
    }
    thermalMatrix.push(row);
  }
  const flat = thermalMatrix.flat();
  return { matrix: thermalMatrix, min: Math.min(...flat), max: Math.max(...flat), unit: 'K' };
}

function rampColor(
  norm: number,
  mode: 'ELEVATION_PROFILE' | 'SLOPE_PROFILE' | 'THERMAL_PROFILE'
): string {
  const t = Math.max(0, Math.min(1, norm));
  if (mode === 'ELEVATION_PROFILE') {
    return `rgb(${Math.round(12 + t * 210)},${Math.round(22 + t * 215)},${Math.round(48 + t * 200)})`;
  }
  if (mode === 'SLOPE_PROFILE') {
    if (t < 0.5) {
      const u = t * 2;
      return `rgb(${Math.round(15 + u * 30)},${Math.round(28 + u * 160)},${Math.round(45 + u * 195)})`;
    }
    const u = (t - 0.5) * 2;
    return `rgb(${Math.round(45 + u * 200)},${Math.round(188 - u * 45)},${Math.round(240 - u * 215)})`;
  }
  if (t < 0.5) {
    const u = t * 2;
    return `rgb(${Math.round(10)},${Math.round(18 + u * 205)},${Math.round(68 + u * 185)})`;
  }
  const u = (t - 0.5) * 2;
  return `rgb(${Math.round(10 + u * 238)},${Math.round(223 - u * 65)},${Math.round(253 - u * 225)})`;
}

export const PlanetaryExplorerView: React.FC<PlanetaryExplorerViewProps> = ({
  targets,
  activeTargetId,
  onSelectTarget,
  onNavigateDiscovery,
}) => {
  const target = targets.find((t) => t.id === activeTargetId) ?? targets[0];
  const [activeLayer, setActiveLayer] = useState<ExplorerLayer>('VISUAL_REF');
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const [cursorProbe, setCursorProbe] = useState<{
    lat: number;
    lon: number;
    sampledVal: number | null;
    unit: string;
  }>({
    lat: target.coordinates.lat,
    lon: target.coordinates.lon,
    sampledVal: null,
    unit: '',
  });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const rasterData = useMemo(() => {
    if (
      activeLayer === 'ELEVATION_PROFILE' ||
      activeLayer === 'SLOPE_PROFILE' ||
      activeLayer === 'THERMAL_PROFILE'
    ) {
      return generateCraterGrid(target.id, activeLayer);
    }
    return null;
  }, [target.id, activeLayer]);

  useEffect(() => {
    setPan({ x: 0, y: 0 });
    setZoom(1);
    setCursorProbe({
      lat: target.coordinates.lat,
      lon: target.coordinates.lon,
      sampledVal: null,
      unit: '',
    });
  }, [target.id, target.coordinates.lat, target.coordinates.lon]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !rasterData || activeLayer === 'VISUAL_REF' || activeLayer === 'HYPERSPECTRAL_BAND') {
      return;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    const cellW = w / GRID_SIZE;
    const cellH = h / GRID_SIZE;
    const span = rasterData.max - rasterData.min || 1;

    ctx.clearRect(0, 0, w, h);
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        const val = rasterData.matrix[y][x];
        const norm = (val - rasterData.min) / span;
        ctx.fillStyle = rampColor(norm, activeLayer);
        ctx.fillRect(Math.floor(x * cellW), Math.floor(y * cellH), Math.ceil(cellW), Math.ceil(cellH));
      }
    }

    ctx.strokeStyle = 'rgba(34, 211, 238, 0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(w / 2, 0);
    ctx.lineTo(w / 2, h);
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();
  }, [rasterData, activeLayer]);

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = (e.clientX - rect.left) / rect.width;
    const relY = (e.clientY - rect.top) / rect.height;

    if (isDragging && dragStartRef.current) {
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      setPan({
        x: Math.max(-220, Math.min(220, dragStartRef.current.panX + dx)),
        y: Math.max(-160, Math.min(160, dragStartRef.current.panY + dy)),
      });
    }

    const latOffset = (0.5 - relY) * (1.2 / zoom);
    const lonOffset = (relX - 0.5) * (1.2 / zoom);
    const sampledLat = Math.max(-90, Math.min(90, target.coordinates.lat + latOffset));
    const sampledLon = target.coordinates.lon + lonOffset;

    let sampledVal: number | null = null;
    let unit = '';
    if (rasterData) {
      const gx = Math.max(0, Math.min(GRID_SIZE - 1, Math.floor(relX * GRID_SIZE)));
      const gy = Math.max(0, Math.min(GRID_SIZE - 1, Math.floor(relY * GRID_SIZE)));
      sampledVal = rasterData.matrix[gy][gx];
      unit = rasterData.unit;
    }

    setCursorProbe({ lat: sampledLat, lon: sampledLon, sampledVal, unit });
  };

  return (
    <div className="space-y-5">
      {/* Segmented Target & Layer Control Bar */}
      <div className="gw-reveal t9-glass-panel rounded-2xl border p-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 bg-[#04060A] p-1 rounded-xl border border-white/[0.06]">
          {targets.map((t) => {
            const active = t.id === target.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onSelectTarget(t.id)}
                className={`px-3.5 py-1.5 rounded-lg font-mono text-xs cursor-pointer transition-all whitespace-nowrap ${
                  active
                    ? 'bg-cyan-400 text-slate-950 font-semibold shadow-sm'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                {t.body}: {t.name}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-mono text-[11px] text-slate-500 mr-1 inline-flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5" /> Layer
          </span>
          {(
            [
              { id: 'VISUAL_REF', label: 'Orbital Reference' },
              { id: 'ELEVATION_PROFILE', label: 'Elevation (DEM)' },
              { id: 'SLOPE_PROFILE', label: 'Terrain Slope' },
              { id: 'THERMAL_PROFILE', label: 'Thermal (IR)' },
              { id: 'HYPERSPECTRAL_BAND', label: 'Hyperspectral Cube' },
            ] as const
          ).map((layer) => (
            <button
              key={layer.id}
              type="button"
              onClick={() => setActiveLayer(layer.id)}
              className={`px-3 py-1.5 rounded-lg font-mono text-xs cursor-pointer whitespace-nowrap transition-colors ${
                activeLayer === layer.id
                  ? 'bg-cyan-400/15 border border-cyan-400/50 text-cyan-300'
                  : 'bg-white/[0.03] border border-white/[0.06] text-slate-400 hover:text-slate-100'
              }`}
            >
              {layer.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Split Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        <ModuleCard
          title={`${target.body} Orbital Viewport — ${target.name}`}
          className="lg:col-span-8"
          rightSlot={
            <StatusIndicator
              tone={activeLayer === 'HYPERSPECTRAL_BAND' ? 'amber' : 'cyan'}
              label={
                activeLayer === 'VISUAL_REF'
                  ? 'Visual Reference'
                  : activeLayer === 'HYPERSPECTRAL_BAND'
                  ? 'Data Unavailable'
                  : 'Analytical Profile'
              }
            />
          }
        >
          <div className="space-y-3">
            <div
              className="relative w-full h-[380px] lg:h-[460px] rounded-xl bg-[#04060A] border border-white/[0.08] overflow-hidden cursor-crosshair select-none"
              onPointerDown={(e) => {
                setIsDragging(true);
                dragStartRef.current = {
                  x: e.clientX,
                  y: e.clientY,
                  panX: pan.x,
                  panY: pan.y,
                };
              }}
              onPointerUp={() => {
                setIsDragging(false);
                dragStartRef.current = null;
              }}
              onPointerLeave={() => {
                setIsDragging(false);
                dragStartRef.current = null;
              }}
              onPointerMove={handlePointerMove}
            >
              {activeLayer === 'HYPERSPECTRAL_BAND' ? (
                <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-[#04060A]">
                  <AlertTriangle className="w-9 h-9 text-amber-400 mb-3" />
                  <div className="font-mono text-sm font-bold uppercase tracking-wider text-amber-400">
                    Data Unavailable — Raster Band Not Loaded
                  </div>
                  <p className="text-xs text-slate-300 max-w-md mt-2 leading-relaxed">
                    {target.unavailableBands[0]?.instrument}:{' '}
                    {target.unavailableBands[0]?.product}.{' '}
                    {target.unavailableBands[0]?.reason}
                  </p>
                  <p className="font-mono text-[11px] text-slate-500 mt-3">
                    TERRA-9 refuses to synthesize spectral mineral classifications without verified
                    PDS / GeoTIFF input.
                  </p>
                </div>
              ) : (
                <div
                  className="w-full h-full flex items-center justify-center transition-transform duration-100 ease-out"
                  style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
                >
                  {activeLayer === 'VISUAL_REF' ? (
                    <img
                      src={PLANETARY_VISUAL_REFS[target.id]}
                      alt={`${target.name} visual reference`}
                      referrerPolicy="no-referrer"
                      draggable={false}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <canvas
                      ref={canvasRef}
                      width={720}
                      height={460}
                      className="w-full h-full object-cover"
                      data-testid="planetary-raster-canvas"
                    />
                  )}
                </div>
              )}

              {/* Coordinate HUD */}
              <div className="pointer-events-none absolute top-3 left-3 rounded-lg bg-[#04060A]/85 backdrop-blur-md border border-white/10 px-3 py-1.5 font-mono text-[11px] space-y-0.5">
                <div className="flex items-center gap-2 text-cyan-300">
                  <Crosshair className="w-3.5 h-3.5" />
                  <span className="tabular-nums">
                    {cursorProbe.lat.toFixed(3)}°, {cursorProbe.lon.toFixed(3)}°
                  </span>
                </div>
                {cursorProbe.sampledVal !== null && (
                  <div className="text-white tabular-nums">
                    Sample: {cursorProbe.sampledVal.toFixed(1)} {cursorProbe.unit}
                  </div>
                )}
              </div>

              {/* Zoom / Pan Controls */}
              <div className="absolute top-3 right-3 flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.min(2.6, Number((z + 0.25).toFixed(2))))}
                  aria-label="Zoom in planetary viewport"
                  className="w-8 h-8 rounded-lg bg-[#04060A]/85 backdrop-blur-md border border-white/15 text-slate-100 hover:border-cyan-400 hover:text-cyan-300 flex items-center justify-center cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.max(1, Number((z - 0.25).toFixed(2))))}
                  aria-label="Zoom out planetary viewport"
                  className="w-8 h-8 rounded-lg bg-[#04060A]/85 backdrop-blur-md border border-white/15 text-slate-100 hover:border-cyan-400 hover:text-cyan-300 flex items-center justify-center cursor-pointer"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setZoom(1);
                    setPan({ x: 0, y: 0 });
                  }}
                  aria-label="Reset planetary viewport zoom and pan"
                  className="w-8 h-8 rounded-lg bg-[#04060A]/85 backdrop-blur-md border border-white/15 text-slate-100 hover:border-cyan-400 hover:text-cyan-300 flex items-center justify-center cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="pointer-events-none absolute bottom-3 left-3 right-3 rounded-lg flex flex-wrap items-center justify-between gap-2 bg-[#04060A]/85 backdrop-blur-md border border-white/10 px-3 py-1.5 font-mono text-[10px] text-slate-300">
                <span>
                  {activeLayer === 'VISUAL_REF'
                    ? 'ILLUSTRATIVE DATA — ORBITAL CONTEXT IMAGE (NOT DIRECT SCIENTIFIC RASTER)'
                    : activeLayer === 'HYPERSPECTRAL_BAND'
                    ? 'DATA UNAVAILABLE'
                    : `MODELED SPATIAL PROFILE DERIVED FROM PUBLISHED ${target.body === 'MOON' ? 'LRO LOLA / DIVINER' : 'MGS MOLA / THEMIS'} PARAMETERS`}
                </span>
                <span className="text-sky-400 tabular-nums">ZOOM {zoom.toFixed(2)}×</span>
              </div>
            </div>

            {rasterData && (
              <div className="flex items-center justify-between gap-4 font-mono text-[11px] pt-1">
                <span className="text-slate-400 tabular-nums">
                  Min: {rasterData.min.toFixed(1)} {rasterData.unit}
                </span>
                <div
                  className="flex-1 h-2 rounded-full border border-white/10"
                  style={{
                    background:
                      activeLayer === 'ELEVATION_PROFILE'
                        ? 'linear-gradient(to right, rgb(12,22,48), rgb(117,130,148), rgb(222,237,248))'
                        : activeLayer === 'SLOPE_PROFILE'
                        ? 'linear-gradient(to right, rgb(15,28,45), rgb(45,188,240), rgb(245,143,25))'
                        : 'linear-gradient(to right, rgb(10,18,68), rgb(10,223,253), rgb(248,158,28))',
                  }}
                />
                <span className="text-slate-400 tabular-nums">
                  Max: {rasterData.max.toFixed(1)} {rasterData.unit}
                </span>
              </div>
            )}
          </div>
        </ModuleCard>

        {/* Unboxed Divider-Driven Telemetry Inspector */}
        <ModuleCard title="Target Telemetry & Provenance" className="lg:col-span-4">
          <div className="space-y-4">
            <div className="border-b border-white/[0.07] pb-3.5">
              <div className="font-mono text-[11px] text-sky-400">
                {target.body} · {target.region}
              </div>
              <h3 className="font-display text-xl font-semibold text-white mt-0.5">
                {target.name}
              </h3>
              <p className="font-mono text-xs text-slate-400 mt-1">
                {target.coordinates.formatted} · {target.diameterKm} km diameter
              </p>
              <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                {target.geologicalContext}
              </p>
            </div>

            <div className="divide-y divide-white/[0.06]">
              {(
                [
                  { key: 'elevation', label: 'Elevation Datum' },
                  { key: 'slope', label: 'Terrain Slope' },
                  { key: 'surfaceTemp', label: 'Surface Radiometric Temp' },
                  { key: 'precipitation', label: 'Precipitation' },
                  { key: 'solarIrradiance', label: 'Solar Irradiance' },
                ] as const
              ).map(({ key, label }) => {
                const m = target.parameters[key];
                return (
                  <div key={key} className="py-2.5 first:pt-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[11px] text-slate-400">{label}</span>
                      <span className="font-mono text-[10px] text-sky-400">{m.source}</span>
                    </div>
                    <div className="font-mono text-sm font-semibold text-white tabular-nums mt-0.5">
                      {m.isAvailable && m.value !== null
                        ? `${m.value} ${m.unit}`
                        : 'DATA UNAVAILABLE / N/A'}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                      {m.provenanceNote}
                    </p>
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              onClick={onNavigateDiscovery}
              className="w-full py-2.5 rounded-xl bg-cyan-400 text-slate-950 hover:bg-cyan-300 font-display text-xs font-semibold tracking-wide cursor-pointer transition-colors"
            >
              Find Earth Analogs for {target.name}
            </button>
          </div>
        </ModuleCard>
      </div>
    </div>
  );
};
