import React, { useMemo, useState } from 'react';
import { ArrowRight, Filter, Search } from 'lucide-react';
import type {
  AnalysisRunRecord,
  EarthSite,
  PlanetaryTarget,
  SiteSimilarityEvaluation,
  TargetId,
  TerrainCategory,
} from '../engine/types';
import { SITE_VISUAL_REFS } from '../utils/planetaryImages';
import { EarthWorldMap, type MapFocusTarget } from './EarthWorldMap';
import { ModuleCard, SegmentedMetricBar, StatusIndicator } from './TelemetryPrimitives';

interface EarthAnalogDiscoveryViewProps {
  targets: PlanetaryTarget[];
  activeTargetId: TargetId;
  onSelectTarget: (targetId: TargetId) => void;
  sites: EarthSite[];
  analysis: AnalysisRunRecord | null;
  selectedSiteId: string;
  onSelectSite: (siteId: string) => void;
  onOpenComparison: (siteId: string) => void;
  mapFocusTarget?: MapFocusTarget | null;
}

export const EarthAnalogDiscoveryView: React.FC<EarthAnalogDiscoveryViewProps> = ({
  targets,
  activeTargetId,
  onSelectTarget,
  sites,
  analysis,
  selectedSiteId,
  onSelectSite,
  onOpenComparison,
  mapFocusTarget,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [terrainFilter, setTerrainFilter] = useState<'ALL' | TerrainCategory>('ALL');
  const [minCompleteness, setMinCompleteness] = useState<number>(0);

  const evaluationsById = useMemo(() => {
    const map: Record<string, SiteSimilarityEvaluation> = {};
    if (analysis) {
      for (const r of analysis.results) {
        map[r.siteId] = r;
      }
    }
    return map;
  }, [analysis]);

  const filteredSites = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return sites
      .filter((site) => {
        if (q) {
          const hit =
            site.name.toLowerCase().includes(q) ||
            site.country.toLowerCase().includes(q) ||
            site.subregion.toLowerCase().includes(q);
          if (!hit) return false;
        }
        if (terrainFilter !== 'ALL' && site.terrainCategory !== terrainFilter) {
          return false;
        }
        if (site.dataCompletenessPct < minCompleteness) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        const evalA = evaluationsById[a.id];
        const evalB = evaluationsById[b.id];
        const scoreA = evalA?.overallSimilarityScore ?? -1;
        const scoreB = evalB?.overallSimilarityScore ?? -1;
        return scoreB - scoreA;
      });
  }, [sites, searchQuery, terrainFilter, minCompleteness, evaluationsById]);

  const activeSite =
    sites.find((s) => s.id === selectedSiteId) ?? filteredSites[0] ?? sites[0];
  const activeEval = activeSite ? evaluationsById[activeSite.id] : undefined;
  const activeTarget = targets.find((t) => t.id === activeTargetId) ?? targets[0];
  const siteVisual = activeSite ? SITE_VISUAL_REFS[activeSite.id] : undefined;

  return (
    <div className="space-y-5">
      {/* Unified Single-Row Filter & Search Bar */}
      <div className="gw-reveal t9-glass-panel rounded-2xl border p-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 bg-[#04060A] p-1 rounded-xl border border-white/[0.06]">
          {targets.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onSelectTarget(t.id)}
              className={`px-3 py-1.5 rounded-lg font-mono text-xs cursor-pointer whitespace-nowrap transition-all ${
                t.id === activeTargetId
                  ? 'bg-cyan-400 text-slate-950 font-semibold'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              {t.body}: {t.name}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2 flex-1 justify-end">
          <div className="relative w-44">
            <label htmlFor="earth-site-search" className="sr-only">
              Search terrestrial candidate locations
            </label>
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              id="earth-site-search"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search site..."
              className="w-full rounded-lg bg-[#04060A] border border-white/10 focus:border-cyan-400 focus:outline-none pl-8 pr-3 py-1.5 font-mono text-xs text-slate-100 placeholder:text-slate-500"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-500" />
            <label htmlFor="terrain-filter" className="sr-only">
              Filter by terrain category
            </label>
            <select
              id="terrain-filter"
              value={terrainFilter}
              onChange={(e) => setTerrainFilter(e.target.value as 'ALL' | TerrainCategory)}
              className="rounded-lg bg-[#04060A] border border-white/10 focus:border-cyan-400 focus:outline-none px-2.5 py-1.5 font-mono text-xs text-slate-100"
            >
              <option value="ALL">All Terrains</option>
              <option value="Hyper-Arid Desert">Hyper-Arid Desert</option>
              <option value="Polar / Cryogenic">Polar / Cryogenic</option>
              <option value="Volcanic / Basaltic">Volcanic / Basaltic</option>
              <option value="High-Altitude / Evaporite">High-Altitude / Evaporite</option>
            </select>
          </div>

          <div>
            <label htmlFor="completeness-filter" className="sr-only">
              Filter by minimum data completeness
            </label>
            <select
              id="completeness-filter"
              value={minCompleteness}
              onChange={(e) => setMinCompleteness(Number(e.target.value))}
              className="rounded-lg bg-[#04060A] border border-white/10 focus:border-cyan-400 focus:outline-none px-2.5 py-1.5 font-mono text-xs text-slate-100"
            >
              <option value={0}>Completeness: All</option>
              <option value={80}>Completeness &ge; 80%</option>
              <option value={100}>Completeness 100%</option>
            </select>
          </div>
        </div>
      </div>

      {/* Map + Site Inspector Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        <ModuleCard
          title="Global Terrestrial Candidate Map"
          className="lg:col-span-7"
          rightSlot={
            <span className="font-mono text-xs text-slate-400 tabular-nums">
              {filteredSites.length} / {sites.length} sites
            </span>
          }
        >
          <EarthWorldMap
            sites={filteredSites}
            evaluationsById={evaluationsById}
            selectedSiteId={activeSite?.id ?? ''}
            onSelectSite={onSelectSite}
            focusTarget={mapFocusTarget}
          />
        </ModuleCard>

        <ModuleCard
          title="Selected Candidate Telemetry"
          className="lg:col-span-5"
          rightSlot={
            activeSite && (
              <StatusIndicator
                tone={activeSite.dataCompletenessPct === 100 ? 'nominal' : 'amber'}
                label={`${activeSite.dataCompletenessPct}% Coverage`}
              />
            )
          }
        >
          {activeSite ? (
            <div className="space-y-4">
              {siteVisual && (
                <div className="relative h-28 rounded-xl overflow-hidden border border-white/[0.08]">
                  <img
                    src={siteVisual}
                    alt={`${activeSite.name} reconnaissance preview`}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0B101B] via-transparent to-transparent" />
                  <span className="absolute bottom-2 left-3 font-mono text-[10px] text-slate-300">
                    Terrain Reference · {activeSite.name}
                  </span>
                </div>
              )}

              <div className="border-b border-white/[0.07] pb-3">
                <div className="font-mono text-[11px] text-sky-400">
                  {activeSite.country} · {activeSite.terrainCategory}
                </div>
                <h3 className="font-display text-xl font-semibold text-white mt-0.5">
                  {activeSite.name}
                </h3>
                <p className="font-mono text-xs text-slate-400 mt-0.5">
                  {activeSite.subregion} · {activeSite.coordinates.formatted}
                </p>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between font-mono text-[11px] text-slate-400">
                  <span>Similarity vs {activeTarget.name}</span>
                  <span className="text-cyan-300">
                    {activeEval?.rank ? `Rank #${activeEval.rank}` : 'Unranked'}
                  </span>
                </div>
                <SegmentedMetricBar
                  value={activeEval?.overallSimilarityScore ?? null}
                  segments={18}
                />
                <div className="font-mono text-[11px] text-slate-500">
                  {activeEval
                    ? `${activeEval.comparableFeatureCount}/${activeEval.totalConfiguredFeatures} comparable features · Confidence: ${activeEval.confidenceLevel}`
                    : 'Run comparative analysis to compute score.'}
                </div>
              </div>

              {/* Clean Unboxed Telemetry Grid */}
              <div className="grid grid-cols-2 gap-x-6 gap-y-3 py-3 border-y border-white/[0.07] font-mono">
                <div>
                  <div className="text-[10px] text-slate-500 uppercase">Elevation</div>
                  <div className="text-xs font-semibold text-slate-100 tabular-nums mt-0.5">
                    {activeSite.parameters.elevation.value !== null
                      ? `${activeSite.parameters.elevation.value} ${activeSite.parameters.elevation.unit}`
                      : 'DATA UNAVAILABLE'}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-500 uppercase">Slope Gradient</div>
                  <div className="text-xs font-semibold text-slate-100 tabular-nums mt-0.5">
                    {activeSite.parameters.slope.value !== null
                      ? `${activeSite.parameters.slope.value} deg`
                      : 'DATA UNAVAILABLE'}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-500 uppercase">MODIS Surface LST</div>
                  <div className="text-xs font-semibold text-slate-100 tabular-nums mt-0.5">
                    {activeSite.parameters.surfaceTemp.isAvailable &&
                    activeSite.parameters.surfaceTemp.value !== null
                      ? `${activeSite.parameters.surfaceTemp.value} K`
                      : 'DATA UNAVAILABLE'}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-500 uppercase">Air Temp 2m (POWER)</div>
                  <div className="text-xs font-semibold text-slate-400 tabular-nums mt-0.5">
                    {activeSite.parameters.airTemp2m.isAvailable &&
                    activeSite.parameters.airTemp2m.value !== null
                      ? `${activeSite.parameters.airTemp2m.value} °C`
                      : 'DATA UNAVAILABLE'}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-500 uppercase">Precipitation</div>
                  <div className="text-xs font-semibold text-slate-100 tabular-nums mt-0.5">
                    {activeSite.parameters.precipitation.value !== null
                      ? `${activeSite.parameters.precipitation.value} mm/yr`
                      : 'DATA UNAVAILABLE'}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-500 uppercase">Solar Irradiance</div>
                  <div className="text-xs font-semibold text-slate-100 tabular-nums mt-0.5">
                    {activeSite.parameters.solarIrradiance.value !== null
                      ? `${activeSite.parameters.solarIrradiance.value} W/m²`
                      : 'DATA UNAVAILABLE'}
                  </div>
                </div>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                {activeTarget.body === 'MOON'
                  ? activeSite.analogRelevance.moon
                  : activeSite.analogRelevance.mars}
              </p>

              <button
                type="button"
                onClick={() => onOpenComparison(activeSite.id)}
                className="w-full py-2.5 rounded-xl bg-cyan-400 text-slate-950 hover:bg-cyan-300 font-display text-xs font-semibold tracking-wide flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                <span>Compare Against {activeTarget.name}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="text-xs font-mono text-slate-400">
              Select a candidate location on the map or table.
            </div>
          )}
        </ModuleCard>
      </div>

      {/* Ranked Candidate Table */}
      <ModuleCard
        title={`Ranked Earth Analog Candidates — ${activeTarget.name} (${activeTarget.body})`}
      >
        {filteredSites.length === 0 ? (
          <div className="py-8 text-center font-mono text-xs text-slate-400">
            No terrestrial candidates match the current search and filter constraints.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/[0.08] font-mono text-[10px] uppercase tracking-wider text-slate-500">
                  <th className="py-2.5 pr-3">Rank</th>
                  <th className="py-2.5 pr-3">Candidate Location</th>
                  <th className="py-2.5 pr-3">Coordinates</th>
                  <th className="py-2.5 pr-3">Terrain Class</th>
                  <th className="py-2.5 pr-3">Coverage</th>
                  <th className="py-2.5 pr-3">Relative Similarity</th>
                  <th className="py-2.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05] text-xs">
                {filteredSites.map((site) => {
                  const ev = evaluationsById[site.id];
                  const isSel = site.id === activeSite?.id;
                  return (
                    <tr
                      key={site.id}
                      className={`transition-colors ${
                        isSel ? 'bg-cyan-400/[0.07]' : 'hover:bg-white/[0.03]'
                      }`}
                    >
                      <td className="py-3 pr-3 font-mono font-semibold text-sky-400 tabular-nums">
                        {ev?.rank ? `#${String(ev.rank).padStart(2, '0')}` : '—'}
                      </td>
                      <td className="py-3 pr-3">
                        <div className="font-medium text-slate-100">{site.name}</div>
                        <div className="font-mono text-[11px] text-slate-500">{site.country}</div>
                      </td>
                      <td className="py-3 pr-3 font-mono text-[11px] text-slate-400 tabular-nums whitespace-nowrap">
                        {site.coordinates.formatted}
                      </td>
                      <td className="py-3 pr-3 font-mono text-[11px] text-slate-400">
                        {site.terrainCategory}
                      </td>
                      <td className="py-3 pr-3 font-mono text-[11px] tabular-nums">
                        <span
                          className={
                            site.dataCompletenessPct === 100
                              ? 'text-emerald-400'
                              : 'text-amber-400'
                          }
                        >
                          {site.dataCompletenessPct}%
                        </span>
                      </td>
                      <td className="py-3 pr-3">
                        <SegmentedMetricBar
                          value={ev?.overallSimilarityScore ?? null}
                          segments={12}
                        />
                      </td>
                      <td className="py-3 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => onSelectSite(site.id)}
                          className="px-2.5 py-1 mr-1.5 rounded-md bg-white/[0.04] border border-white/10 hover:border-cyan-400 font-mono text-[11px] text-slate-200 cursor-pointer"
                        >
                          Inspect
                        </button>
                        <button
                          type="button"
                          onClick={() => onOpenComparison(site.id)}
                          className="px-2.5 py-1 rounded-md bg-cyan-400/15 border border-cyan-400/40 hover:bg-cyan-400 hover:text-slate-950 font-mono text-[11px] text-cyan-300 cursor-pointer transition-colors"
                        >
                          Compare
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </ModuleCard>
    </div>
  );
};
