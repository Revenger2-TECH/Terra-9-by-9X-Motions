import React, { useMemo, useState } from 'react';
import { AlertTriangle, FileText, Play, RotateCcw } from 'lucide-react';
import type { Data } from 'plotly.js-dist-min';
import { DEFAULT_FEATURE_WEIGHTS, FEATURE_SCALES } from '../engine/similarity';
import type {
  AnalysisRunRecord,
  EarthSite,
  FeatureKey,
  FeatureWeights,
  PlanetaryTarget,
  TargetId,
  TemperatureComparisonMode,
} from '../engine/types';
import { PlotlyChart } from './PlotlyChart';
import { ModuleCard, SegmentedMetricBar, StatusIndicator } from './TelemetryPrimitives';

interface ComparativeAnalysisViewProps {
  targets: PlanetaryTarget[];
  activeTargetId: TargetId;
  onSelectTarget: (targetId: TargetId) => void;
  sites: EarthSite[];
  selectedSiteId: string;
  onSelectSite: (siteId: string) => void;
  analysis: AnalysisRunRecord | null;
  onRunAnalysis: (
    targetId: TargetId,
    weights: FeatureWeights,
    temperatureMode: TemperatureComparisonMode
  ) => Promise<void>;
  analysisStageText: string | null;
  onGenerateReport: (analysisId: string, siteId: string) => Promise<void>;
}

const WEIGHT_KEYS: Array<{ key: FeatureKey; label: string }> = [
  { key: 'elevation', label: 'Elevation (Datum)' },
  { key: 'slope', label: 'Terrain Slope' },
  { key: 'surfaceTemp', label: 'Surface Temp' },
  { key: 'precipitation', label: 'Precipitation / Aridity' },
  { key: 'solarIrradiance', label: 'Solar Irradiance' },
];

export const ComparativeAnalysisView: React.FC<ComparativeAnalysisViewProps> = ({
  targets,
  activeTargetId,
  onSelectTarget,
  sites,
  selectedSiteId,
  onSelectSite,
  analysis,
  onRunAnalysis,
  analysisStageText,
  onGenerateReport,
}) => {
  const [weights, setWeights] = useState<FeatureWeights>(
    analysis?.weights ?? { ...DEFAULT_FEATURE_WEIGHTS }
  );
  const [temperatureMode, setTemperatureMode] = useState<TemperatureComparisonMode>(
    analysis?.temperatureMode ?? 'MODIS_SURFACE_LST'
  );
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

  const siteEval = useMemo(() => {
    if (!analysis) return null;
    return analysis.results.find((r) => r.siteId === selectedSiteId) ?? analysis.results[0] ?? null;
  }, [analysis, selectedSiteId]);

  const activeTarget = targets.find((t) => t.id === activeTargetId) ?? targets[0];
  const activeSite = sites.find((s) => s.id === selectedSiteId) ?? sites[0];

  const totalConfiguredWeight = Object.values(weights).reduce((s, v) => s + v, 0);

  const barChartData: Data[] = useMemo(() => {
    if (!siteEval) return [];
    const labels = siteEval.featureBreakdown.map((f) => f.label);
    const similarities = siteEval.featureBreakdown.map((f) =>
      f.similarityContribution !== null ? Number((f.similarityContribution * 100).toFixed(1)) : 0
    );
    const colors = siteEval.featureBreakdown.map((f) => {
      if (!f.includedInScore) return '#334155';
      if ((f.similarityContribution ?? 0) >= 0.72) return '#22D3EE';
      if ((f.similarityContribution ?? 0) >= 0.5) return '#38BDF8';
      return '#F59E0B';
    });

    return [
      {
        type: 'bar',
        orientation: 'h',
        y: labels,
        x: similarities,
        marker: { color: colors },
        text: siteEval.featureBreakdown.map((f) =>
          f.similarityContribution !== null
            ? `${(f.similarityContribution * 100).toFixed(1)}%`
            : f.compatibilityStatus === 'INCOMPATIBLE_MEASUREMENT_TYPE'
            ? 'EXCLUDED (INCOMPATIBLE)'
            : 'DATA UNAVAILABLE'
        ),
        textposition: 'outside',
        hovertemplate: '%{y}: %{x}% normalized similarity<extra></extra>',
      },
    ];
  }, [siteEval]);

  const radarChartData: Data[] = useMemo(() => {
    if (!siteEval) return [];
    const included = siteEval.featureBreakdown.filter(
      (f) => f.includedInScore && f.similarityContribution !== null
    );
    if (included.length < 2) return [];

    const shortLabelMap: Record<FeatureKey, string> = {
      elevation: 'Elevation',
      slope: 'Slope',
      surfaceTemp: 'Surface Temp',
      precipitation: 'Precipitation',
      solarIrradiance: 'Solar Flux',
    };

    const theta = [
      ...included.map((f) => shortLabelMap[f.feature]),
      shortLabelMap[included[0].feature],
    ];
    const rSite = [
      ...included.map((f) => Number(((f.similarityContribution ?? 0) * 100).toFixed(1))),
      Number(((included[0].similarityContribution ?? 0) * 100).toFixed(1)),
    ];
    const rTargetRef = theta.map(() => 100);

    return [
      {
        type: 'scatterpolar',
        r: rTargetRef,
        theta,
        fill: 'none',
        name: `${activeTarget.name} Baseline`,
        line: { color: '#38BDF8', dash: 'dot', width: 1.5 },
      },
      {
        type: 'scatterpolar',
        r: rSite,
        theta,
        fill: 'toself',
        fillcolor: 'rgba(34, 211, 238, 0.18)',
        name: `${activeSite.name}`,
        line: { color: '#22D3EE', width: 2 },
      },
    ];
  }, [siteEval, activeTarget.name, activeSite.name]);

  const handleWeightChange = (key: FeatureKey, val: number) => {
    setWeights((prev) => ({
      ...prev,
      [key]: Math.max(0, Math.min(1, Number(val))),
    }));
  };

  const handleExecuteAnalysis = async () => {
    await onRunAnalysis(activeTargetId, weights, temperatureMode);
  };

  const handleReportClick = async () => {
    if (!analysis || !siteEval) return;
    setIsGeneratingReport(true);
    try {
      await onGenerateReport(analysis.analysisId, siteEval.siteId);
    } finally {
      setIsGeneratingReport(false);
    }
  };

  return (
    <div className="space-y-5">
      <ModuleCard
        title="Comparative Pair & Similarity Engine"
        subtitle="Weighted feature-distance model · Explainable numerical scoring"
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="compare-target-select"
                  className="block font-mono text-[11px] text-slate-400 mb-1.5"
                >
                  Planetary Target
                </label>
                <select
                  id="compare-target-select"
                  value={activeTargetId}
                  onChange={(e) => onSelectTarget(e.target.value as TargetId)}
                  className="w-full rounded-lg bg-[#04060A] border border-white/15 focus:border-cyan-400 focus:outline-none px-2.5 py-2 font-mono text-[11px] text-slate-100"
                >
                  {targets.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.body}: {t.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="compare-site-select"
                  className="block font-mono text-[11px] text-slate-400 mb-1.5"
                >
                  Earth Candidate
                </label>
                <select
                  id="compare-site-select"
                  value={selectedSiteId}
                  onChange={(e) => onSelectSite(e.target.value)}
                  className="w-full rounded-lg bg-[#04060A] border border-white/15 focus:border-cyan-400 focus:outline-none px-2.5 py-2 font-mono text-[11px] text-slate-100"
                >
                  {sites.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.country})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-white/[0.06]">
              <div className="font-mono text-[11px] text-sky-400">
                Thermal Measurement Compatibility Guard
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setTemperatureMode('MODIS_SURFACE_LST')}
                  className={`px-3 py-2.5 rounded-xl font-mono text-[11px] text-left border cursor-pointer transition-colors ${
                    temperatureMode === 'MODIS_SURFACE_LST'
                      ? 'border-cyan-400/60 bg-cyan-400/10 text-cyan-300'
                      : 'border-white/[0.08] bg-[#04060A] text-slate-400 hover:text-slate-200'
                  }`}
                >
                  MODIS Surface LST (K)
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    Radiative skin temp · Comparable
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setTemperatureMode('NASA_POWER_AIR_2M')}
                  className={`px-3 py-2.5 rounded-xl font-mono text-[11px] text-left border cursor-pointer transition-colors ${
                    temperatureMode === 'NASA_POWER_AIR_2M'
                      ? 'border-amber-400/70 bg-amber-400/10 text-amber-300'
                      : 'border-white/[0.08] bg-[#04060A] text-slate-400 hover:text-slate-200'
                  }`}
                >
                  POWER 2m Air Temp (°C)
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    Incompatible · Auto-excluded
                  </div>
                </button>
              </div>
            </div>
          </div>

          <div className="lg:col-span-7 lg:pl-6 lg:border-l lg:border-white/[0.07] flex flex-col justify-between gap-4">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-[11px] text-slate-400">
                Feature Weights (Renormalized over valid comparable channels)
              </span>
              <button
                type="button"
                onClick={() => setWeights({ ...DEFAULT_FEATURE_WEIGHTS })}
                className="inline-flex items-center gap-1 font-mono text-[11px] text-sky-400 hover:text-cyan-300 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" /> Reset Defaults
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-5 gap-y-3">
              {WEIGHT_KEYS.map(({ key, label }) => (
                <div key={key} className="space-y-1">
                  <div className="flex items-center justify-between font-mono text-[11px]">
                    <label htmlFor={`weight-${key}`} className="text-slate-300">
                      {label}
                    </label>
                    <span className="text-white tabular-nums">
                      {(weights[key] * 100).toFixed(0)}%
                    </span>
                  </div>
                  <input
                    id={`weight-${key}`}
                    type="range"
                    min={0}
                    max={0.6}
                    step={0.05}
                    value={weights[key]}
                    onChange={(e) => handleWeightChange(key, Number(e.target.value))}
                    className="w-full accent-cyan-400 cursor-pointer"
                  />
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-white/[0.07]">
              <div className="font-mono text-[11px] text-slate-400 tabular-nums">
                Configured Weight Sum:{' '}
                <span className={totalConfiguredWeight <= 0 ? 'text-rose-400' : 'text-cyan-300'}>
                  {(totalConfiguredWeight * 100).toFixed(0)}%
                </span>
              </div>
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  disabled={Boolean(analysisStageText) || totalConfiguredWeight <= 0}
                  onClick={handleExecuteAnalysis}
                  className="px-4 py-2 rounded-xl bg-cyan-400 text-slate-950 hover:bg-cyan-300 disabled:opacity-50 font-display text-xs font-semibold tracking-wide inline-flex items-center gap-2 cursor-pointer transition-colors"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>{analysisStageText ? analysisStageText : 'Run Analysis'}</span>
                </button>
                <button
                  type="button"
                  disabled={!analysis || !siteEval || isGeneratingReport}
                  onClick={handleReportClick}
                  className="px-4 py-2 rounded-xl bg-white/[0.05] border border-white/10 hover:border-cyan-400/60 text-slate-100 hover:text-cyan-300 disabled:opacity-50 font-mono text-xs inline-flex items-center gap-2 cursor-pointer transition-colors"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>{isGeneratingReport ? 'Generating...' : 'Generate Report'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </ModuleCard>

      {siteEval && (
        <ModuleCard
          title={`Analytical Result: ${activeTarget.name} vs ${activeSite.name}`}
          rightSlot={
            <StatusIndicator
              tone={
                siteEval.confidenceLevel === 'HIGH'
                  ? 'nominal'
                  : siteEval.confidenceLevel === 'INSUFFICIENT'
                  ? 'error'
                  : 'amber'
              }
              label={`Confidence: ${siteEval.confidenceLevel}`}
            />
          }
        >
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            <div className="lg:col-span-4 lg:pr-6 lg:border-r lg:border-white/[0.07] space-y-2.5">
              <div className="font-mono text-[11px] text-slate-400">
                Overall Relative Similarity Index
              </div>
              <div className="font-mono text-4xl font-bold text-white tabular-nums tracking-tight">
                {siteEval.overallSimilarityScore !== null
                  ? `${(siteEval.overallSimilarityScore * 100).toFixed(1)}%`
                  : 'INSUFFICIENT'}
              </div>
              <SegmentedMetricBar value={siteEval.overallSimilarityScore} segments={20} />
              <div className="font-mono text-[11px] text-slate-400 tabular-nums pt-1">
                Rank: {siteEval.rank ? `#${siteEval.rank} of ${analysis?.eligibleRankedCount}` : 'Unranked'} · Coverage:{' '}
                {(siteEval.coverageRatio * 100).toFixed(0)}% ({siteEval.comparableFeatureCount}/
                {siteEval.totalConfiguredFeatures} features)
              </div>
            </div>

            <div className="lg:col-span-8 space-y-3">
              <p className="text-sm text-slate-100 leading-relaxed">
                {siteEval.rankingExplanation}
              </p>
              {siteEval.scientificWarnings.length > 0 && (
                <div className="rounded-xl bg-amber-500/10 border border-amber-400/30 p-3.5 space-y-1">
                  <div className="flex items-center gap-1.5 font-mono text-[11px] font-semibold uppercase tracking-wider text-amber-300">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Scientific Integrity & Compatibility Notices
                  </div>
                  {siteEval.scientificWarnings.map((warn, i) => (
                    <p key={i} className="text-xs text-amber-100/90">
                      {warn}
                    </p>
                  ))}
                </div>
              )}
            </div>
          </div>
        </ModuleCard>
      )}

      {siteEval && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <ModuleCard title="Parameter Similarity Contribution" className="lg:col-span-7">
            <PlotlyChart
              data={barChartData}
              layout={{
                xaxis: {
                  title: { text: 'Normalized Similarity (%)' },
                  range: [0, 118],
                  gridcolor: 'rgba(148,163,184,0.1)',
                  zerolinecolor: 'rgba(148,163,184,0.2)',
                },
                yaxis: {
                  automargin: true,
                  gridcolor: 'rgba(148,163,184,0.06)',
                },
                margin: { t: 16, r: 45, b: 44, l: 160 },
              }}
              className="w-full h-72"
              testId="plotly-bar-chart"
            />
          </ModuleCard>

          <ModuleCard title="Similarity Profile (Polar)" className="lg:col-span-5">
            {radarChartData.length > 0 ? (
              <PlotlyChart
                data={radarChartData}
                layout={{
                  polar: {
                    bgcolor: 'rgba(4, 6, 10, 0.7)',
                    radialaxis: {
                      visible: true,
                      range: [0, 100],
                      gridcolor: 'rgba(148,163,184,0.12)',
                      tickfont: { size: 9, color: '#64748B' },
                    },
                    angularaxis: {
                      gridcolor: 'rgba(148,163,184,0.12)',
                      tickfont: { size: 10, color: '#CBD5E1' },
                    },
                  },
                  legend: {
                    orientation: 'h',
                    y: -0.2,
                    font: { size: 10, color: '#94A3B8' },
                  },
                  margin: { t: 32, r: 72, b: 56, l: 72 },
                }}
                className="w-full h-72"
                testId="plotly-radar-chart"
              />
            ) : (
              <div className="h-72 flex items-center justify-center font-mono text-xs text-amber-400">
                DATA UNAVAILABLE — At least 2 comparable features required for polar profile.
              </div>
            )}
          </ModuleCard>
        </div>
      )}

      {siteEval && (
        <ModuleCard title="Feature-Level Mathematical & Provenance Comparison">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/[0.08] font-mono text-[10px] uppercase tracking-wider text-slate-500">
                  <th className="py-2.5 pr-3">Parameter</th>
                  <th className="py-2.5 pr-3">{activeTarget.name}</th>
                  <th className="py-2.5 pr-3">{activeSite.name}</th>
                  <th className="py-2.5 pr-3 text-right">Abs Delta</th>
                  <th className="py-2.5 pr-3">Compatibility</th>
                  <th className="py-2.5 pr-3 text-right">Eff. Weight</th>
                  <th className="py-2.5 text-right">Similarity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05] text-xs">
                {siteEval.featureBreakdown.map((row) => {
                  const statusTone =
                    row.compatibilityStatus === 'COMPATIBLE'
                      ? 'nominal'
                      : row.compatibilityStatus === 'COMPATIBLE_WITH_CAVEAT'
                      ? 'cyan'
                      : row.compatibilityStatus === 'INCOMPATIBLE_MEASUREMENT_TYPE'
                      ? 'error'
                      : 'amber';

                  return (
                    <tr key={row.feature} className="hover:bg-white/[0.02] align-top">
                      <td className="py-3 pr-3">
                        <div className="font-medium text-slate-100">{row.label}</div>
                        <div className="font-mono text-[10px] text-slate-500">
                          Span: {FEATURE_SCALES[row.feature].maxSpan}{' '}
                          {FEATURE_SCALES[row.feature].unit}
                        </div>
                      </td>
                      <td className="py-3 pr-3 font-mono tabular-nums">
                        <div className="text-slate-100">
                          {row.planetaryValue !== null
                            ? `${row.planetaryValue} ${row.planetaryUnit}`
                            : 'DATA UNAVAILABLE'}
                        </div>
                        <div className="text-[10px] text-slate-500">{row.planetarySource}</div>
                      </td>
                      <td className="py-3 pr-3 font-mono tabular-nums">
                        <div className="text-slate-100">
                          {row.earthValue !== null
                            ? `${row.earthValue} ${row.earthUnit}`
                            : 'DATA UNAVAILABLE'}
                        </div>
                        <div className="text-[10px] text-slate-500">{row.earthSource}</div>
                      </td>
                      <td className="py-3 pr-3 font-mono text-right tabular-nums text-slate-400">
                        {row.absoluteDifference !== null
                          ? `${row.absoluteDifference} ${row.differenceUnit}`
                          : '—'}
                      </td>
                      <td className="py-3 pr-3 max-w-xs">
                        <StatusIndicator
                          tone={statusTone}
                          label={row.compatibilityStatus.replace(/_/g, ' ')}
                        />
                        <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                          {row.compatibilityNote}
                        </p>
                      </td>
                      <td className="py-3 pr-3 font-mono text-right tabular-nums text-slate-400">
                        {row.includedInScore ? `${(row.effectiveWeight * 100).toFixed(1)}%` : '0.0%'}
                      </td>
                      <td className="py-3 font-mono text-right font-semibold tabular-nums text-cyan-300">
                        {row.similarityContribution !== null
                          ? `${(row.similarityContribution * 100).toFixed(1)}%`
                          : 'EXCLUDED'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </ModuleCard>
      )}
    </div>
  );
};
