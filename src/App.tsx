import React, { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity,
  BarChart3,
  Compass,
  Database,
  FileText,
  Globe,
  Info,
  Menu,
  Orbit,
  Play,
  Sparkles,
  X,
} from 'lucide-react';
import { DEFAULT_FEATURE_WEIGHTS } from './engine/similarity';
import type {
  ActivityEvent,
  AnalysisRunRecord,
  DatasetRegistryEntry,
  EarthSite,
  FeatureWeights,
  MissionReport,
  PlanetaryTarget,
  TargetId,
  TemperatureComparisonMode,
} from './engine/types';
import { ComparativeAnalysisView } from './components/ComparativeAnalysisView';
import { DataIntelligenceView } from './components/DataIntelligenceView';
import { EarthAnalogDiscoveryView } from './components/EarthAnalogDiscoveryView';
import { MissionControlView, type ModuleRoute } from './components/MissionControlView';
import { MissionReportsView } from './components/MissionReportsView';
import { PlanetaryExplorerView } from './components/PlanetaryExplorerView';
import { SystemInformationView } from './components/SystemInformationView';
import { StatusIndicator } from './components/TelemetryPrimitives';
import PerspectiveTunnelHero from './components/ui/perspective-tunnel-hero';

const NAV_ITEMS: Array<{
  id: ModuleRoute;
  code: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'mission-control', code: '01', label: 'Mission Control', icon: Activity },
  { id: 'planetary-explorer', code: '02', label: 'Planetary Explorer', icon: Orbit },
  { id: 'earth-discovery', code: '03', label: 'Earth Analog Discovery', icon: Globe },
  { id: 'comparative-analysis', code: '04', label: 'Comparative Analysis', icon: BarChart3 },
  { id: 'data-intelligence', code: '05', label: 'Data Intelligence', icon: Database },
  { id: 'mission-reports', code: '06', label: 'Mission Reports', icon: FileText },
  { id: 'system-info', code: '07', label: 'System Information', icon: Info },
];

interface ToastState {
  id: number;
  tone: 'cyan' | 'amber' | 'error';
  text: string;
}

export default function App() {
  const initialSkipIntro =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('autostart') === '1';

  const [showSpatialIntro, setShowSpatialIntro] = useState<boolean>(!initialSkipIntro);
  const [activeRoute, setActiveRoute] = useState<ModuleRoute>('mission-control');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [targets, setTargets] = useState<PlanetaryTarget[]>([]);
  const [activeTargetId, setActiveTargetId] = useState<TargetId>('shackleton');
  const [earthSites, setEarthSites] = useState<EarthSite[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState<string>('atacama');
  const [datasets, setDatasets] = useState<DatasetRegistryEntry[]>([]);
  const [analysisByTarget, setAnalysisByTarget] = useState<
    Partial<Record<TargetId, AnalysisRunRecord>>
  >({});
  const [reports, setReports] = useState<MissionReport[]>([]);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [activityLog, setActivityLog] = useState<ActivityEvent[]>([]);

  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [analysisStageText, setAnalysisStageText] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);

  const pushToast = useCallback((tone: ToastState['tone'], text: string) => {
    const id = Date.now();
    setToast({ id, tone, text });
    setTimeout(() => {
      setToast((prev) => (prev?.id === id ? null : prev));
    }, 4200);
  }, []);

  const refreshActivity = useCallback(async () => {
    try {
      const res = await fetch('/api/activity');
      if (res.ok) {
        const data = await res.json();
        setActivityLog(data.events ?? []);
      }
    } catch {
      // Non-fatal background refresh
    }
  }, []);

  const loadWorkspace = useCallback(async () => {
    setLoadingInitial(true);
    setLoadError(null);
    try {
      const [tRes, sRes, dRes, rRes, aRes, anlMoon, anlMars] = await Promise.all([
        fetch('/api/targets'),
        fetch('/api/earth-sites'),
        fetch('/api/datasets'),
        fetch('/api/reports'),
        fetch('/api/activity'),
        fetch('/api/analysis/latest?targetId=shackleton'),
        fetch('/api/analysis/latest?targetId=jezero'),
      ]);

      if (!tRes.ok || !sRes.ok || !dRes.ok) {
        throw new Error('Failed to load TERRA-9 backend scientific catalog.');
      }

      const tData = await tRes.json();
      const sData = await sRes.json();
      const dData = await dRes.json();
      const rData = rRes.ok ? await rRes.json() : { reports: [] };
      const aData = aRes.ok ? await aRes.json() : { events: [] };

      setTargets(tData.targets ?? []);
      setEarthSites(sData.sites ?? []);
      setDatasets(dData.datasets ?? []);
      setReports(rData.reports ?? []);
      setActivityLog(aData.events ?? []);

      const nextAnalyses: Partial<Record<TargetId, AnalysisRunRecord>> = {};
      if (anlMoon.ok) nextAnalyses.shackleton = await anlMoon.json();
      if (anlMars.ok) nextAnalyses.jezero = await anlMars.json();
      setAnalysisByTarget(nextAnalyses);
    } catch (err) {
      setLoadError(
        err instanceof Error ? err.message : 'Unable to initialize TERRA-9 workspace.'
      );
    } finally {
      setLoadingInitial(false);
    }
  }, []);

  useEffect(() => {
    loadWorkspace();
  }, [loadWorkspace]);

  const handleSelectTarget = async (targetId: TargetId) => {
    setActiveTargetId(targetId);
    const target = targets.find((t) => t.id === targetId);
    if (target) {
      pushToast('cyan', `Target locked: ${target.body} · ${target.name}`);
      fetch('/api/activity/target-switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetId }),
      }).then(() => refreshActivity());
    }
  };

  const handleRunAnalysis = async (
    targetId: TargetId,
    weights: FeatureWeights = DEFAULT_FEATURE_WEIGHTS,
    temperatureMode: TemperatureComparisonMode = 'MODIS_SURFACE_LST'
  ) => {
    const stages = [
      'INITIALISING ANALYSIS',
      'LOADING PLANETARY FEATURES',
      'VALIDATING EARTH DATA',
      'CALCULATING FEATURE DISTANCES',
      'GENERATING ANALOG RANKING',
    ];

    try {
      for (const stage of stages.slice(0, 4)) {
        setAnalysisStageText(stage);
        await new Promise((r) => setTimeout(r, 110));
      }
      setAnalysisStageText(stages[4]);

      const res = await fetch('/api/analysis/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetId, weights, temperatureMode }),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || 'Analysis run failed.');
      }

      const record: AnalysisRunRecord = await res.json();
      setAnalysisByTarget((prev) => ({ ...prev, [targetId]: record }));
      await refreshActivity();
      pushToast(
        'cyan',
        `Analysis ${record.analysisId} complete (${record.eligibleRankedCount} sites ranked)`
      );
    } catch (err) {
      pushToast('error', err instanceof Error ? err.message : 'Analysis failed.');
    } finally {
      setAnalysisStageText(null);
    }
  };

  const handleGenerateReport = async (analysisId: string, siteId: string) => {
    try {
      const res = await fetch('/api/reports/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ analysisId, siteId }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || 'Report generation failed.');
      }
      const report: MissionReport = await res.json();
      setReports((prev) => [report, ...prev]);
      setSelectedReportId(report.reportId);
      setActiveRoute('mission-reports');
      await refreshActivity();
      pushToast('cyan', `Dossier ${report.reportId} generated`);
    } catch (err) {
      pushToast('error', err instanceof Error ? err.message : 'Could not generate report.');
    }
  };

  const handleIngestDataset = async (payload: {
    datasetName: string;
    format: 'CSV' | 'JSON';
    content: string;
    agency: string;
    units: string;
  }): Promise<{ ok: boolean; message: string }> => {
    try {
      const res = await fetch('/api/datasets/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        const detailText = Array.isArray(data.details) ? ` (${data.details.join('; ')})` : '';
        return { ok: false, message: `${data.error || 'Validation error'}${detailText}` };
      }

      const [dRes, sRes] = await Promise.all([
        fetch('/api/datasets'),
        fetch('/api/earth-sites'),
      ]);
      if (dRes.ok) setDatasets((await dRes.json()).datasets ?? []);
      if (sRes.ok) setEarthSites((await sRes.json()).sites ?? []);

      await handleRunAnalysis(
        activeTargetId,
        analysisByTarget[activeTargetId]?.weights ?? DEFAULT_FEATURE_WEIGHTS,
        analysisByTarget[activeTargetId]?.temperatureMode ?? 'MODIS_SURFACE_LST'
      );

      return {
        ok: true,
        message: `Registered "${data.dataset.name}" (${data.addedSites?.length ?? 0} candidate site(s) indexed).`,
      };
    } catch (err) {
      return {
        ok: false,
        message: err instanceof Error ? err.message : 'Failed to ingest dataset.',
      };
    }
  };

  const handleEnterFromTunnel = (selection?: { targetId?: TargetId; siteId?: string }) => {
    if (selection?.targetId) {
      setActiveTargetId(selection.targetId);
      setActiveRoute('planetary-explorer');
    } else if (selection?.siteId) {
      setSelectedSiteId(selection.siteId);
      setActiveRoute('earth-discovery');
    } else {
      setActiveRoute('mission-control');
    }
    setShowSpatialIntro(false);
  };

  const activeNav = NAV_ITEMS.find((item) => item.id === activeRoute) ?? NAV_ITEMS[0];
  const currentAnalysis = analysisByTarget[activeTargetId] ?? null;
  const activeTarget = targets.find((t) => t.id === activeTargetId) ?? null;
  const readyDatasetCount = datasets.filter(
    (d) => d.availabilityStatus !== 'UNAVAILABLE'
  ).length;

  if (showSpatialIntro) {
    return <PerspectiveTunnelHero onEnterWorkspace={handleEnterFromTunnel} />;
  }

  return (
    <div className="min-h-screen bg-[#04060A] t9-atmosphere text-[#F8FAFC] flex flex-col lg:flex-row">
      {/* Sleek Glassmorphic Left Sidebar */}
      <aside
        aria-label="Primary Module Navigation"
        className={`fixed inset-y-0 left-0 z-50 w-[264px] bg-[#070B13]/95 backdrop-blur-xl border-r border-white/[0.07] flex flex-col justify-between transition-transform duration-150 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 shrink-0 overflow-y-auto ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div>
          <div className="p-5 border-b border-white/[0.07] flex items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-cyan-400/10 border border-cyan-400/30 flex items-center justify-center">
                  <Compass className="w-4 h-4 text-cyan-400" />
                </div>
                <span className="font-display text-lg font-bold tracking-tight text-white">
                  TERRA-9
                </span>
              </div>
              <div className="font-mono text-[10px] tracking-[0.12em] text-slate-400 uppercase mt-2">
                Earth Analog Intelligence
              </div>
              <div className="font-mono text-[10px] text-sky-400 mt-0.5">
                by 9X MOTIONS
              </div>
            </div>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              aria-label="Close navigation menu"
              className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <nav className="p-3 space-y-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = item.id === activeRoute;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setActiveRoute(item.id);
                    setMobileMenuOpen(false);
                  }}
                  aria-current={isActive ? 'page' : undefined}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium text-left transition-all cursor-pointer whitespace-nowrap ${
                    isActive
                      ? 'bg-cyan-400/12 border border-cyan-400/40 text-cyan-300 shadow-[inset_0_1px_0_0_rgba(34,211,238,0.15)]'
                      : 'border border-transparent text-slate-400 hover:bg-white/[0.04] hover:text-slate-100'
                  }`}
                >
                  <span className="font-mono text-[10px] text-slate-500 tabular-nums">
                    {item.code}
                  </span>
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}

            <div className="pt-2 mt-2 border-t border-white/[0.06]">
              <button
                type="button"
                onClick={() => {
                  setShowSpatialIntro(true);
                  setMobileMenuOpen(false);
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium text-left text-sky-300 hover:bg-sky-400/10 border border-transparent hover:border-sky-400/30 transition-all cursor-pointer whitespace-nowrap"
              >
                <Sparkles className="w-4 h-4 shrink-0 text-cyan-400" />
                <span>3D Spatial Corridor</span>
              </button>
            </div>
          </nav>
        </div>

        <div className="p-4 border-t border-white/[0.07] space-y-2 font-mono text-[10px]">
          <div className="flex items-center justify-between gap-2">
            <span className="text-slate-500 uppercase">System</span>
            <StatusIndicator
              tone={analysisStageText ? 'cyan' : 'nominal'}
              label={analysisStageText ? 'Computing' : 'Operational'}
            />
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-slate-500 uppercase">Target</span>
            <span className="text-slate-200 truncate">
              {activeTarget ? `${activeTarget.body} · ${activeTarget.name}` : '—'}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-slate-500 uppercase">Datasets</span>
            <span className="text-sky-400 tabular-nums">
              {readyDatasetCount}/{datasets.length} Ready
            </span>
          </div>
          <div className="pt-2 border-t border-white/[0.06] text-slate-500 leading-relaxed">
            Beyond Earth. Grounded in Data. Driven by Discovery.
          </div>
        </div>
      </aside>

      {/* Main Content Shell */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 bg-[#070B13]/80 backdrop-blur-xl border-b border-white/[0.07] px-4 lg:px-6 flex items-center justify-between gap-4 sticky top-0 z-30">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation menu"
              className="lg:hidden p-1.5 rounded-lg border border-white/15 text-slate-100 cursor-pointer"
            >
              <Menu className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="font-mono text-xs text-cyan-400 font-semibold tabular-nums">
                {activeNav.code}
              </span>
              <span className="font-display text-sm sm:text-base font-semibold tracking-tight text-white truncate">
                {activeNav.label}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-lg bg-white/[0.04] border border-white/[0.07] font-mono text-[11px]">
              <span className="text-slate-500">Target:</span>
              <span className="text-cyan-300 font-medium whitespace-nowrap">
                {activeTarget ? `${activeTarget.body}: ${activeTarget.name}` : 'Loading'}
              </span>
            </div>

            <button
              type="button"
              disabled={Boolean(analysisStageText) || loadingInitial}
              onClick={() => {
                handleRunAnalysis(
                  activeTargetId,
                  currentAnalysis?.weights ?? DEFAULT_FEATURE_WEIGHTS,
                  currentAnalysis?.temperatureMode ?? 'MODIS_SURFACE_LST'
                );
              }}
              className="px-4 py-1.5 rounded-lg bg-cyan-400 text-slate-950 hover:bg-cyan-300 disabled:opacity-50 font-display text-xs font-semibold tracking-wide inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap transition-colors"
            >
              <Play className="w-3 h-3" />
              <span>{analysisStageText ? analysisStageText : 'Run Analysis'}</span>
            </button>
          </div>
        </header>

        {toast && (
          <div
            role="status"
            className={`fixed bottom-5 right-5 z-50 px-4 py-2.5 rounded-xl bg-[#0B101B]/95 backdrop-blur-md border font-mono text-xs flex items-center gap-2.5 shadow-xl ${
              toast.tone === 'error'
                ? 'border-rose-400/50 text-rose-300'
                : toast.tone === 'amber'
                ? 'border-amber-400/50 text-amber-300'
                : 'border-cyan-400/50 text-cyan-300'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-current inline-block" />
            <span>{toast.text}</span>
          </div>
        )}

        <main className="flex-1 p-5 lg:p-7 max-w-[1560px] w-full mx-auto">
          {loadingInitial ? (
            <div className="rounded-2xl bg-[#0B101B]/85 border border-white/[0.08] p-12 text-center space-y-2">
              <div className="font-mono text-xs uppercase tracking-widest text-cyan-400">
                Initialising TERRA-9 Workspace
              </div>
              <div className="font-mono text-xs text-slate-400">
                Loading planetary targets, Earth candidate datasets, and provenance catalog...
              </div>
            </div>
          ) : loadError ? (
            <div className="rounded-2xl bg-[#0B101B] border border-rose-500/50 p-6 space-y-3">
              <div className="font-mono text-xs font-bold uppercase text-rose-400">
                Workspace Initialization Error
              </div>
              <p className="text-sm text-slate-100">{loadError}</p>
              <button
                type="button"
                onClick={loadWorkspace}
                className="px-4 py-2 rounded-lg bg-cyan-400 text-slate-950 font-mono text-xs font-bold uppercase cursor-pointer"
              >
                Retry Connection
              </button>
            </div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={activeRoute}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              >
                {activeRoute === 'mission-control' && (
                  <MissionControlView
                    targets={targets}
                    activeTargetId={activeTargetId}
                    onSelectTarget={handleSelectTarget}
                    earthSites={earthSites}
                    datasets={datasets}
                    latestAnalysis={currentAnalysis}
                    activityLog={activityLog}
                    onNavigate={setActiveRoute}
                    onGenerateTopReport={() => {
                      const top = currentAnalysis?.results.find((r) => r.rank === 1);
                      if (currentAnalysis && top) {
                        handleGenerateReport(currentAnalysis.analysisId, top.siteId);
                      } else {
                        pushToast('amber', 'Run analysis first to generate a ranked report.');
                      }
                    }}
                    onOpenSpatialCorridor={() => setShowSpatialIntro(true)}
                  />
                )}

                {activeRoute === 'planetary-explorer' && (
                  <PlanetaryExplorerView
                    targets={targets}
                    activeTargetId={activeTargetId}
                    onSelectTarget={handleSelectTarget}
                    onNavigateDiscovery={() => setActiveRoute('earth-discovery')}
                  />
                )}

                {activeRoute === 'earth-discovery' && (
                  <EarthAnalogDiscoveryView
                    targets={targets}
                    activeTargetId={activeTargetId}
                    onSelectTarget={handleSelectTarget}
                    sites={earthSites}
                    analysis={currentAnalysis}
                    selectedSiteId={selectedSiteId}
                    onSelectSite={setSelectedSiteId}
                    onOpenComparison={(siteId) => {
                      setSelectedSiteId(siteId);
                      setActiveRoute('comparative-analysis');
                    }}
                  />
                )}

                {activeRoute === 'comparative-analysis' && (
                  <ComparativeAnalysisView
                    targets={targets}
                    activeTargetId={activeTargetId}
                    onSelectTarget={handleSelectTarget}
                    sites={earthSites}
                    selectedSiteId={selectedSiteId}
                    onSelectSite={setSelectedSiteId}
                    analysis={currentAnalysis}
                    onRunAnalysis={handleRunAnalysis}
                    analysisStageText={analysisStageText}
                    onGenerateReport={handleGenerateReport}
                  />
                )}

                {activeRoute === 'data-intelligence' && (
                  <DataIntelligenceView
                    datasets={datasets}
                    onIngestDataset={handleIngestDataset}
                  />
                )}

                {activeRoute === 'mission-reports' && (
                  <MissionReportsView
                    reports={reports}
                    selectedReportId={selectedReportId}
                    onSelectReport={setSelectedReportId}
                    latestAnalysis={currentAnalysis}
                    selectedSiteId={selectedSiteId}
                    onGenerateReport={handleGenerateReport}
                  />
                )}

                {activeRoute === 'system-info' && <SystemInformationView />}
              </motion.div>
            </AnimatePresence>
          )}
        </main>

        <footer className="border-t border-white/[0.06] bg-[#070B13]/60 px-5 lg:px-7 py-3.5 flex flex-wrap items-center justify-between gap-3 font-mono text-[11px] text-slate-500">
          <span>
            TERRA-9 · Earth Analog Intelligence System · Developed by{' '}
            <strong className="text-slate-300">9X MOTIONS</strong>
          </span>
          <span>
            NASA Space Apps Challenge 2026 Research Platform · Similarity scores are relative
            indices, not claims of equivalence.
          </span>
        </footer>
      </div>
    </div>
  );
}
