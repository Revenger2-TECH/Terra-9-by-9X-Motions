import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { Crosshair, Maximize2, Minus, Plus } from 'lucide-react';
import type { EarthSite, SiteSimilarityEvaluation } from '../engine/types';
import { WORLD_CONTINENT_POLYGONS } from '../data/worldLand';

interface EarthWorldMapProps {
  sites: EarthSite[];
  evaluationsById: Record<string, SiteSimilarityEvaluation>;
  selectedSiteId: string;
  onSelectSite: (siteId: string) => void;
}

export const EarthWorldMap: React.FC<EarthWorldMapProps> = ({
  sites,
  evaluationsById,
  selectedSiteId,
  onSelectSite,
}) => {
  const mapDivRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerLayerRef = useRef<L.LayerGroup | null>(null);
  const [cursorCoords, setCursorCoords] = useState<{ lat: number; lon: number }>({
    lat: 10.0,
    lon: 0.0,
  });
  const [zoomLevel, setZoomLevel] = useState<number>(1.35);

  useEffect(() => {
    if (!mapDivRef.current || mapInstanceRef.current) return;

    const map = L.map(mapDivRef.current, {
      center: [6, 8],
      zoom: 1.35,
      zoomSnap: 0.25,
      minZoom: 1,
      maxZoom: 8,
      zoomControl: false,
      attributionControl: true,
      worldCopyJump: false,
      maxBounds: [
        [-88, -180],
        [88, 180],
      ],
    });

    const graticuleGroup = L.layerGroup().addTo(map);
    for (let lat = -75; lat <= 75; lat += 15) {
      L.polyline(
        [
          [lat, -180],
          [lat, 180],
        ],
        {
          color: lat === 0 ? 'rgba(56, 189, 248, 0.25)' : 'rgba(148, 163, 184, 0.1)',
          weight: lat === 0 ? 1.1 : 0.7,
          dashArray: lat === 0 ? undefined : '2 4',
          interactive: false,
        }
      ).addTo(graticuleGroup);
    }
    for (let lon = -180; lon <= 180; lon += 30) {
      L.polyline(
        [
          [-85, lon],
          [85, lon],
        ],
        {
          color: lon === 0 ? 'rgba(56, 189, 248, 0.25)' : 'rgba(148, 163, 184, 0.1)',
          weight: lon === 0 ? 1.1 : 0.7,
          dashArray: lon === 0 ? undefined : '2 4',
          interactive: false,
        }
      ).addTo(graticuleGroup);
    }

    const landGroup = L.layerGroup().addTo(map);
    for (const continent of WORLD_CONTINENT_POLYGONS) {
      L.polygon(continent.rings, {
        color: 'rgba(148, 163, 184, 0.28)',
        weight: 1,
        fillColor: '#111927',
        fillOpacity: 0.92,
        interactive: false,
      }).addTo(landGroup);
    }

    const markerLayer = L.layerGroup().addTo(map);
    markerLayerRef.current = markerLayer;
    mapInstanceRef.current = map;

    map.on('mousemove', (ev: L.LeafletMouseEvent) => {
      setCursorCoords({ lat: ev.latlng.lat, lon: ev.latlng.lng });
    });

    map.on('zoomend', () => {
      setZoomLevel(map.getZoom());
    });

    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize();
    });
    resizeObserver.observe(mapDivRef.current);

    return () => {
      resizeObserver.disconnect();
      map.remove();
      mapInstanceRef.current = null;
      markerLayerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapInstanceRef.current;
    const layer = markerLayerRef.current;
    if (!map || !layer) return;

    layer.clearLayers();

    for (const site of sites) {
      const evaluation = evaluationsById[site.id];
      const isSelected = site.id === selectedSiteId;
      const score = evaluation?.overallSimilarityScore ?? null;

      let accentColor = '#38BDF8';
      if (isSelected) {
        accentColor = '#22D3EE';
      } else if (score === null) {
        accentColor = '#F59E0B';
      } else if (score >= 0.72) {
        accentColor = '#10B981';
      }

      const scoreText = score !== null ? `${(score * 100).toFixed(1)}%` : 'N/A';

      const iconHtml = `
        <div style="
          position: relative;
          width: ${isSelected ? '18px' : '12px'};
          height: ${isSelected ? '18px' : '12px'};
          border-radius: 9999px;
          border: 2px solid ${accentColor};
          background: ${isSelected ? 'rgba(34, 211, 238, 0.28)' : 'rgba(11, 16, 27, 0.92)'};
          box-shadow: ${isSelected ? `0 0 14px ${accentColor}` : 'none'};
          display: flex;
          align-items: center;
          justify-content: center;
          transform: translate(-50%, -50%);
          cursor: pointer;
        ">
          <div style="
            width: ${isSelected ? '6px' : '4px'};
            height: ${isSelected ? '6px' : '4px'};
            border-radius: 9999px;
            background: ${accentColor};
          "></div>
          ${
            isSelected
              ? `<div style="
                  position: absolute;
                  top: -22px;
                  left: 50%;
                  transform: translateX(-50%);
                  background: rgba(4, 6, 10, 0.92);
                  border: 1px solid rgba(34, 211, 238, 0.7);
                  border-radius: 6px;
                  color: #22D3EE;
                  padding: 1px 6px;
                  font-family: 'JetBrains Mono', monospace;
                  font-size: 9px;
                  white-space: nowrap;
                  letter-spacing: 0.04em;
                ">${site.name} · ${scoreText}</div>`
              : ''
          }
        </div>
      `;

      const icon = L.divIcon({
        html: iconHtml,
        className: 'terra9-leaflet-marker',
        iconSize: [0, 0],
      });

      const marker = L.marker([site.coordinates.lat, site.coordinates.lon], {
        icon,
        keyboard: true,
        title: `${site.name} (${site.country})`,
      });

      marker.on('click', () => onSelectSite(site.id));

      marker.bindTooltip(
        `<div style="font-family: 'JetBrains Mono', monospace; font-size: 11px; color: #F8FAFC;">
          <strong>${site.name}</strong> (${site.country})<br/>
          ${site.coordinates.formatted} · Score: ${scoreText}
        </div>`,
        { direction: 'top', offset: [0, -10], opacity: 0.96 }
      );

      marker.addTo(layer);
    }
  }, [sites, evaluationsById, selectedSiteId, onSelectSite]);

  return (
    <div className="relative w-full h-[380px] lg:h-[460px] rounded-xl border border-white/[0.08] bg-[#05080F] overflow-hidden">
      <div ref={mapDivRef} className="w-full h-full z-0" data-testid="earth-leaflet-map" />

      <div className="pointer-events-none absolute top-3 left-3 z-[400] rounded-lg bg-[#04060A]/85 backdrop-blur-md border border-white/10 px-3 py-1.5 flex items-center gap-3 font-mono text-[11px] text-slate-400">
        <span className="text-sky-400 uppercase tracking-wider">WGS84</span>
        <span className="tabular-nums text-slate-100">
          {cursorCoords.lat >= 0 ? '+' : ''}
          {cursorCoords.lat.toFixed(2)}°, {cursorCoords.lon >= 0 ? '+' : ''}
          {cursorCoords.lon.toFixed(2)}°
        </span>
        <span className="text-slate-500">Z{zoomLevel.toFixed(1)}</span>
      </div>

      <div className="absolute top-3 right-3 z-[400] flex items-center gap-1">
        <button
          type="button"
          onClick={() => {
            const target = sites.find((s) => s.id === selectedSiteId);
            if (target && mapInstanceRef.current) {
              mapInstanceRef.current.setView([target.coordinates.lat, target.coordinates.lon], 4);
            }
          }}
          aria-label="Center map on selected site"
          className="h-8 px-2.5 rounded-lg bg-[#04060A]/85 backdrop-blur-md border border-white/15 text-slate-100 hover:border-cyan-400 hover:text-cyan-300 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider cursor-pointer"
        >
          <Crosshair className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Lock Site</span>
        </button>
        <button
          type="button"
          onClick={() => mapInstanceRef.current?.zoomIn()}
          aria-label="Zoom in Earth map"
          className="w-8 h-8 rounded-lg bg-[#04060A]/85 backdrop-blur-md border border-white/15 text-slate-100 hover:border-cyan-400 hover:text-cyan-300 flex items-center justify-center cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => mapInstanceRef.current?.zoomOut()}
          aria-label="Zoom out Earth map"
          className="w-8 h-8 rounded-lg bg-[#04060A]/85 backdrop-blur-md border border-white/15 text-slate-100 hover:border-cyan-400 hover:text-cyan-300 flex items-center justify-center cursor-pointer"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => mapInstanceRef.current?.setView([6, 8], 1.35)}
          aria-label="Reset global map view"
          className="w-8 h-8 rounded-lg bg-[#04060A]/85 backdrop-blur-md border border-white/15 text-slate-100 hover:border-cyan-400 hover:text-cyan-300 flex items-center justify-center cursor-pointer"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="pointer-events-none absolute bottom-3 left-3 z-[400] rounded-lg bg-[#04060A]/85 backdrop-blur-md border border-white/10 px-3 py-1.5 flex flex-wrap items-center gap-3 font-mono text-[10px] text-slate-300">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-cyan-400 inline-block" /> Selected
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" /> High Index (&ge;72%)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-sky-400 inline-block" /> Evaluated
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> Partial
        </span>
      </div>
    </div>
  );
};
