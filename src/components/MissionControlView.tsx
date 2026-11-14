import React from 'react';
import {
  ArrowRight,
  Check,
  Compass,
  FileText,
  Globe,
  Orbit,
  SlidersHorizontal,
  Sparkles,
} from 'lucide-react';
import type {
  ActivityEvent,
  AnalysisRunRecord,
  DatasetRegistryEntry,
  EarthSite,
  PlanetaryTarget,
  TargetId,
} from '../engine/types';
import { EARTH_HORIZON_VISUAL, PLANETARY_VISUAL_REFS } from '../utils/planetaryImages';
import { ModuleCard, SegmentedMetricBar, StatusIndicator } from './TelemetryPrimitives';

export type ModuleRoute =
  | 'mission-control'
  | 'planetary-explorer'
  | 'earth-discovery'
  | 'comparative-analysis'
  | 'data-intelligence'
  | 'mission-reports'
  | 'system-info';

interface MissionControlViewProps {
  targets: PlanetaryTarget[];
  activeTargetId: TargetId;
  onSelectTarget: (targetId: TargetId) => void;
  earthSites: EarthSite[];
  datasets: DatasetRegistryEntry[];
  latestAnalysis: AnalysisRunRecord | null;
  activityLog: ActivityEvent[];
  onNavigate: (route: ModuleRoute) => void;
  onGenerateTopReport: () => void;
  onOpenSpatialCorridor: () => void;
}

export const MissionControlView: React.FC<MissionControlViewProps> = ({
  targets,
  activeTargetId,
  onSelectTarget,
  earthSites,
  datasets,
  latestAnalysis,
  activityLog,
  onNavigate,
  onGenerateTopReport,
  onOpenSpatialCorridor,
}) => {
  const activeTarget = targets.find((t) => t.id === activeTargetId) ?? targets[0];
  const readyDatasets = datasets.filter((d) => d.availabilityStatus !== 'UNAVAILABLE').length;
  const topCandidate = latestAnalysis?.results.find((r) => r.rank === 1) ?? null;

  return (
    <div className="space-y-6">
      {/* Editorial Mission Hero Panel */}
      <section className="rounded-2xl bg-[#0B101B]/90 backdrop-blur-md border border-white/[0.08] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)] overflow-hidden grid grid-cols-1 lg:grid-cols-12 items-stretch">
        <div className="lg:col-span-8 p-6 lg:p-8 flex flex-col justify-between gap-7">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2.5 text-xs font-mono text-slate-400">
              <span className="text-cyan-400 font-semibold tracking-widest uppercase">
                TERRA-9
              </span>
              <span aria-hidden="true">·</span>
              <span>9X MOTIONS</span>
              <span aria-hidden="true">·</span>
              <span>NASA Space Apps Challenge 2026</span>
            </div>

            <div className="space-y-2.5">
              <h1 className="font-display text-3xl lg:text-4xl font-bold tracking-tight text-white max-w-2xl [text-wrap:balance]">
                Earth Analog Intelligence System
              </h1>
              <p className="text-sm lg:text-[15px] text-slate-300 max-w-2xl leading-relaxed">
                Beyond Earth. Grounded in Data. Driven by Discovery. TERRA-9 evaluates measurable
                geomorphological, radiometric thermal, and climatological parameters across
                terrestrial research regions against lunar and Martian targets.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => onNavigate('earth-discovery')}
                className="px-4 py-2.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-display text-xs font-semibold tracking-wide transition-colors inline-flex items-center gap-2 cursor-pointer"
              >
                <span>Discover Earth Analogs</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={onOpenSpatialCorridor}
                className="px-4 py-2.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-slate-200 font-mono text-xs transition-colors inline-flex items-center gap-2 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                <span>Launch 3D Spatial Corridor</span>
              </button>
            </div>
          </div>

          {/* Unboxed Typographic KPI Strip separated by hairline dividers */}
          <div className="grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-white/[0.07] pt-5 border-t border-white/[0.07]">
            <div className="pb-3 sm:pb-0 sm:pr-4">
              <div className="font-mono text-[11px] text-slate-500">Active Target</div>
              <div className="font-display text-base font-semibold text-cyan-300 mt-1 truncate">
                {activeTarget ? activeTarget.name : 'None'}
              </div>
              <div className="font-mono text-[11px] text-slate-400">
                {activeTarget?.body ?? '—'}
              </div>
            </div>

            <div className="py-3 sm:py-0 sm:px-4">
              <div className="font-mono text-[11px] text-slate-500">Earth Candidates</div>
              <div className="font-mono text-2xl font-semibold text-white tabular-nums mt-0.5">
                {earthSites.length}
              </div>
              <div className="font-mono text-[11px] text-slate-400">Indexed regions</div>
            </div>

            <div className="pt-3 sm:pt-0 sm:px-4">
              <div className="font-mono text-[11px] text-slate-500">Datasets Ready</div>
              <div className="font-mono text-2xl font-semibold text-white tabular-nums mt-0.5">
                {readyDatasets}
                <span className="text-xs text-slate-500 font-normal ml-1">
                  / {datasets.length}
                </span>
              </div>
              <div className="font-mono text-[11px] text-slate-400">Provenance verified</div>
            </div>

            <div className="pt-3 sm:pt-0 sm:pl-4">
              <div className="font-mono text-[11px] text-slate-500">Last Analysis</div>
              <div className="font-mono text-xs font-medium text-slate-200 tabular-nums mt-1.5">
                {latestAnalysis
                  ? `${latestAnalysis.createdAtUtc.slice(11, 19)} UTC`
                  : 'Not run'}
              </div>
              <div className="font-mono text-[11px] text-slate-400 mt-0.5">
                {latestAnalysis?.analysisId ?? 'Standby'}
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-4 relative min-h-[240px] border-t lg:border-t-0 lg:border-l border-white/[0.07] overflow-hidden bg-[#04060A]">
          <img
            src={EARTH_HORIZON_VISUAL}
            alt="Orbital horizon reference showing Earth atmosphere limb"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover opacity-85"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#04060A] via-[#04060A]/30 to-transparent" />
          <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between gap-2 rounded-xl bg-[#04060A]/80 backdrop-blur-md border border-white/10 px-3.5 py-2.5">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-wider text-sky-400">
                Visual Reference
              </div>
              <div className="text-[11px] text-slate-300">
                Illustrative Orbital Context
              </div>
            </div>
            <StatusIndicator
              tone={latestAnalysis ? 'nominal' : 'amber'}
              label={latestAnalysis ? 'Ready' : 'Standby'}
            />
          </div>
        </div>
      </section>

      {/* Planetary Target Selector */}
      <ModuleCard
        title="Planetary Target Selector"
        subtitle="Lock a lunar or Martian region to calibrate Earth analog distance scoring"
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {targets.map((target) => {
            const isSelected = target.id === activeTargetId;
            return (
              <div
                key={target.id}
                className={`rounded-xl overflow-hidden border transition-all duration-200 flex flex-col ${
                  isSelected
                    ? 'border-cyan-400/60 bg-slate-900/60 shadow-[0_0_30px_-10px_rgba(34,211,238,0.2)]'
                    : 'border-white/[0.08] bg-[#070A12] hover:border-white/20'
                }`}
              >
                <div className="relative h-48 overflow-hidden bg-[#04060A]">
                  <img
                    src={PLANETARY_VISUAL_REFS[target.id]}
                    alt={`${target.body} ${target.name} orbital reference imagery`}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#070A12] via-[#070A12]/20 to-[#04060A]/60" />
                  <div className="absolute top-3 left-4 right-4 flex items-center justify-between gap-2">
                    <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-sky-300">
                      {target.body} Target
                    </span>
                    <span className="font-mono text-[10px] text-slate-300/80">
                      Visual Reference
                    </span>
                  </div>
                  <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between gap-2">
                    <div>
                      <h3 className="font-display text-xl font-semibold text-white">
                        {target.name}
                      </h3>
                      <p className="font-mono text-[11px] text-slate-300">
                        {target.region} · {target.coordinates.formatted}
                      </p>
                    </div>
                    {isSelected && (
                      <span className="inline-flex items-center gap-1 rounded-lg font-mono text-[10px] font-bold uppercase tracking-wider bg-cyan-400 text-slate-950 px-2.5 py-1">
                        <Check className="w-3 h-3" /> Active Lock
                      </span>
                    )}
                  </div>
                </div>

                <div className="p-5 flex-1 flex flex-col justify-between gap-5">
                  <div className="space-y-4">
                    <p className="text-xs text-slate-300 leading-relaxed">{target.summary}</p>

                    <div className="grid grid-cols-3 divide-x divide-white/[0.07] py-2 border-y border-white/[0.06] font-mono">
                      <div className="pr-3">
                        <div className="text-[10px] text-slate-500 uppercase">Elevation</div>
                        <div className="text-sm font-semibold text-white tabular-nums mt-0.5">
                          {target.parameters.elevation.value?.toLocaleString()} m
                        </div>
                      </div>
                      <div className="px-3">
                        <div className="text-[10px] text-slate-500 uppercase">Mean Slope</div>
                        <div className="text-sm font-semibold text-white tabular-nums mt-0.5">
                          {target.parameters.slope.value}°
                        </div>
                      </div>
                      <div className="pl-3">
                        <div className="text-[10px] text-slate-500 uppercase">Surface Temp</div>
                        <div className="text-sm font-semibold text-white tabular-nums mt-0.5">
                          {target.parameters.surfaceTemp.value} K
                        </div>
                      </div>
                    </div>

                    <div className="text-[11px] font-mono text-slate-400">
                      Provenance: {target.datasets.join(' · ')}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => onSelectTarget(target.id)}
                      className={`px-4 py-2 rounded-lg font-mono text-xs font-semibold tracking-wide cursor-pointer transition-colors whitespace-nowrap ${
                        isSelected
                          ? 'bg-cyan-400 text-slate-950 hover:bg-cyan-300'
                          : 'bg-white/[0.06] border border-white/10 text-slate-100 hover:border-cyan-400/60 hover:text-cyan-300'
                      }`}
                    >
                      {isSelected ? 'Target Locked' : `Select ${target.body} Target`}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        onSelectTarget(target.id);
                        onNavigate('planetary-explorer');
                      }}
                      className="px-3.5 py-2 rounded-lg text-sky-400 hover:text-cyan-300 hover:bg-white/[0.04] font-mono text-xs inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap transition-colors"
                    >
                      <span>Open Explorer</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </ModuleCard>

      {/* Bottom Split: Quick Actions + Leading Candidate | Real Session Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-5 flex flex-col gap-5">
          <ModuleCard title="Operational Quick Actions">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => {
                  onSelectTarget('shackleton');
                  onNavigate('planetary-explorer');
                }}
                className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.07] hover:border-cyan-400/50 text-left cursor-pointer group transition-colors"
              >
                <span className="inline-flex items-center gap-2 font-mono text-xs text-slate-200 group-hover:text-cyan-300">
                  <Orbit className="w-4 h-4 text-sky-400" />
                  Explore Moon
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-cyan-300" />
              </button>

              <button
                type="button"
                onClick={() => {
                  onSelectTarget('jezero');
                  onNavigate('planetary-explorer');
                }}
                className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.07] hover:border-cyan-400/50 text-left cursor-pointer group transition-colors"
              >
                <span className="inline-flex items-center gap-2 font-mono text-xs text-slate-200 group-hover:text-cyan-300">
                  <Compass className="w-4 h-4 text-amber-400" />
                  Explore Mars
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-cyan-300" />
              </button>

              <button
                type="button"
                onClick={() => onNavigate('earth-discovery')}
                className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.07] hover:border-cyan-400/50 text-left cursor-pointer group transition-colors"
              >
                <span className="inline-flex items-center gap-2 font-mono text-xs text-slate-200 group-hover:text-cyan-300">
                  <Globe className="w-4 h-4 text-cyan-400" />
                  Discover Earth Analogs
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-cyan-300" />
              </button>

              <button
                type="button"
                onClick={() => onNavigate('comparative-analysis')}
                className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.07] hover:border-cyan-400/50 text-left cursor-pointer group transition-colors"
              >
                <span className="inline-flex items-center gap-2 font-mono text-xs text-slate-200 group-hover:text-cyan-300">
                  <SlidersHorizontal className="w-4 h-4 text-sky-400" />
                  Compare Locations
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-cyan-300" />
              </button>

              <button
                type="button"
                onClick={onGenerateTopReport}
                className="sm:col-span-2 flex items-center justify-between px-4 py-3 rounded-xl bg-cyan-400 text-slate-950 hover:bg-cyan-300 font-display text-xs font-semibold tracking-wide cursor-pointer transition-colors"
              >
                <span className="inline-flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Generate Report ({activeTarget?.name})
                </span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </ModuleCard>

          <ModuleCard title="Leading Analytical Candidate">
            {topCandidate ? (
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-mono text-[11px] text-sky-400">
                      Rank #1 for {latestAnalysis?.targetName}
                    </div>
                    <div className="font-display text-lg font-semibold text-white mt-0.5">
                      {topCandidate.siteName}, {topCandidate.country}
                    </div>
                    <div className="font-mono text-[11px] text-slate-400">
                      {topCandidate.coordinates.formatted} · {topCandidate.comparableFeatureCount}/
                      {topCandidate.totalConfiguredFeatures} features comparable
                    </div>
                  </div>
                  <StatusIndicator
                    tone={topCandidate.confidenceLevel === 'HIGH' ? 'nominal' : 'amber'}
                    label={topCandidate.confidenceLevel}
                  />
                </div>
                <SegmentedMetricBar value={topCandidate.overallSimilarityScore} segments={18} />
                <p className="text-xs text-slate-300 leading-relaxed">
                  {topCandidate.rankingExplanation}
                </p>
              </div>
            ) : (
              <div className="text-xs font-mono text-slate-400">
                No completed ranking available for the selected configuration.
              </div>
            )}
          </ModuleCard>
        </div>

        <ModuleCard
          title="Application Activity Log"
          subtitle="Recorded from actual dataset loads, target locks, analyses, and dossier exports"
          className="lg:col-span-7"
        >
          <div className="divide-y divide-white/[0.06] max-h-[340px] overflow-y-auto pr-1">
            {activityLog.length === 0 ? (
              <div className="py-8 text-center font-mono text-xs text-slate-500">
                No session events recorded yet.
              </div>
            ) : (
              activityLog.map((evt) => (
                <div key={evt.id} className="py-3 flex items-start justify-between gap-4">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2.5 text-xs">
                      <span className="font-mono text-[10px] uppercase tracking-wider text-cyan-400">
                        {evt.category}
                      </span>
                      <span className="text-slate-600" aria-hidden="true">
                        ·
                      </span>
                      <span className="font-medium text-slate-100 truncate">
                        {evt.message}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">{evt.detail}</p>
                  </div>
                  <time className="font-mono text-[11px] text-slate-500 whitespace-nowrap shrink-0 tabular-nums">
                    {evt.timestampUtc.slice(11, 19)} UTC
                  </time>
                </div>
              ))
            )}
          </div>
        </ModuleCard>
      </div>
    </div>
  );
};
