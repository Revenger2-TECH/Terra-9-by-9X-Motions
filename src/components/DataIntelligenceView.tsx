import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Database, Globe2, Upload } from 'lucide-react';
import type { DatasetRegistryEntry, PlanetaryBody } from '../engine/types';
import { ModuleCard, StatusIndicator } from './TelemetryPrimitives';

interface DataIntelligenceViewProps {
  datasets: DatasetRegistryEntry[];
  onIngestDataset: (payload: {
    datasetName: string;
    format: 'CSV' | 'JSON';
    content: string;
    agency: string;
    units: string;
  }) => Promise<{ ok: boolean; message: string }>;
}

const SAMPLE_CSV_TEMPLATE = `site_name,country,lat,lon,elevation_m,slope_deg,surface_temp_k,precipitation_mm_yr,solar_irradiance_wm2
Rio Tinto Basin,Spain,37.70,-6.55,340,8.1,296.5,580,210
Chajnantor Plateau,Chile,-23.02,-67.75,5058,4.2,276.4,NA,295`;

export const DataIntelligenceView: React.FC<DataIntelligenceViewProps> = ({
  datasets,
  onIngestDataset,
}) => {
  const [bodyFilter, setBodyFilter] = useState<'ALL' | PlanetaryBody>('ALL');
  const [expandedId, setExpandedId] = useState<string | null>(datasets[0]?.id ?? null);

  const [datasetName, setDatasetName] = useState('Local Field Campaign Extract');
  const [format, setFormat] = useState<'CSV' | 'JSON'>('CSV');
  const [agency, setAgency] = useState('9X MOTIONS Research Upload');
  const [csvContent, setCsvContent] = useState('');
  const [ingestFeedback, setIngestFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [isIngesting, setIsIngesting] = useState(false);

  const [queryLat, setQueryLat] = useState('-24.08');
  const [queryLon, setQueryLon] = useState('-69.92');
  const [powerLoading, setPowerLoading] = useState(false);
  const [powerResult, setPowerResult] = useState<Record<string, unknown> | null>(null);

  const filteredDatasets = datasets.filter(
    (d) => bodyFilter === 'ALL' || d.body === bodyFilter
  );

  const handleFileRead = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setDatasetName(file.name.replace(/\.(csv|json)$/i, ''));
    setFormat(file.name.toLowerCase().endsWith('.json') ? 'JSON' : 'CSV');
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setCsvContent(reader.result);
      }
    };
    reader.readAsText(file);
  };

  const handleIngestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!csvContent.trim()) {
      setIngestFeedback({
        ok: false,
        text: 'Provide CSV/JSON content or load a local file before ingesting.',
      });
      return;
    }
    setIsIngesting(true);
    setIngestFeedback(null);
    try {
      const res = await onIngestDataset({
        datasetName: datasetName.trim() || 'Local Dataset',
        format,
        content: csvContent,
        agency: agency.trim() || 'Local Researcher',
        units: 'm, deg, K, mm/yr, W/m²',
      });
      setIngestFeedback({ ok: res.ok, text: res.message });
    } finally {
      setIsIngesting(false);
    }
  };

  const handlePowerQuery = async () => {
    setPowerLoading(true);
    try {
      const res = await fetch(
        `/api/external/nasa-power?lat=${encodeURIComponent(queryLat)}&lon=${encodeURIComponent(queryLon)}`
      );
      const data = await res.json();
      setPowerResult(data);
    } catch {
      setPowerResult({
        live: false,
        status: 'REQUEST_FAILED',
        message: 'Failed to reach TERRA-9 backend NASA POWER proxy.',
      });
    } finally {
      setPowerLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      <ModuleCard
        title="Scientific Dataset Registry & Provenance"
        rightSlot={
          <div className="flex items-center gap-1 bg-[#04060A] p-1 rounded-xl border border-white/[0.06]">
            {(['ALL', 'MOON', 'MARS', 'EARTH'] as const).map((b) => (
              <button
                key={b}
                type="button"
                onClick={() => setBodyFilter(b)}
                className={`px-2.5 py-1 rounded-lg font-mono text-[11px] cursor-pointer transition-colors ${
                  bodyFilter === b
                    ? 'bg-cyan-400 text-slate-950 font-semibold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {b}
              </button>
            ))}
          </div>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/[0.08] font-mono text-[10px] uppercase tracking-wider text-slate-500">
                <th className="py-2.5 pr-3">Dataset Name</th>
                <th className="py-2.5 pr-3">Body</th>
                <th className="py-2.5 pr-3">Source / Instrument</th>
                <th className="py-2.5 pr-3">Format</th>
                <th className="py-2.5 pr-3">Units</th>
                <th className="py-2.5 pr-3">Availability</th>
                <th className="py-2.5 text-right">Freshness</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05] text-xs">
              {filteredDatasets.map((ds) => {
                const isExpanded = expandedId === ds.id;
                const availTone =
                  ds.availabilityStatus === 'LOADED_LOCAL' || ds.availabilityStatus === 'API_READY'
                    ? 'nominal'
                    : ds.availabilityStatus === 'PARTIAL_COVERAGE'
                    ? 'amber'
                    : 'error';

                return (
                  <React.Fragment key={ds.id}>
                    <tr className="hover:bg-white/[0.02]">
                      <td className="py-3 pr-3">
                        <button
                          type="button"
                          onClick={() => setExpandedId(isExpanded ? null : ds.id)}
                          className="flex items-center gap-1.5 text-left font-medium text-slate-100 hover:text-cyan-300 cursor-pointer"
                        >
                          {isExpanded ? (
                            <ChevronDown className="w-3.5 h-3.5 shrink-0 text-cyan-400" />
                          ) : (
                            <ChevronRight className="w-3.5 h-3.5 shrink-0 text-slate-500" />
                          )}
                          <span>{ds.name}</span>
                        </button>
                      </td>
                      <td className="py-3 pr-3 font-mono text-[11px] text-sky-400">{ds.body}</td>
                      <td className="py-3 pr-3 text-slate-300">
                        <div>{ds.sourceAgency}</div>
                        <div className="font-mono text-[10px] text-slate-500">{ds.instrument}</div>
                      </td>
                      <td className="py-3 pr-3 font-mono text-[11px] text-slate-200">
                        {ds.fileFormat}
                      </td>
                      <td className="py-3 pr-3 font-mono text-[11px] text-slate-400">
                        {ds.measurementUnits}
                      </td>
                      <td className="py-3 pr-3">
                        <StatusIndicator
                          tone={availTone}
                          label={ds.availabilityStatus.replace(/_/g, ' ')}
                        />
                      </td>
                      <td className="py-3 text-right font-mono text-[11px] text-slate-400">
                        {ds.freshness}
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="bg-[#04060A]/60">
                        <td colSpan={7} className="p-4 border-t border-white/[0.06]">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                            <div>
                              <span className="font-mono text-[10px] uppercase text-slate-500 block">
                                Spatial Coverage
                              </span>
                              <span className="font-mono text-slate-100">{ds.spatialCoverage}</span>
                            </div>
                            <div>
                              <span className="font-mono text-[10px] uppercase text-slate-500 block">
                                Processing Status
                              </span>
                              <span className="font-mono text-sky-400">{ds.processingStatus}</span>
                            </div>
                            <div>
                              <span className="font-mono text-[10px] uppercase text-slate-500 block">
                                Provenance Reference
                              </span>
                              <span className="font-mono text-[11px] text-slate-400 break-all">
                                {ds.provenanceUrl}
                              </span>
                            </div>
                            <div className="md:col-span-3 text-slate-300">{ds.notes}</div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </ModuleCard>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <ModuleCard
          title="Local Scientific Dataset Ingestion (CSV / JSON)"
          className="lg:col-span-6"
          rightSlot={
            <button
              type="button"
              onClick={() => {
                setFormat('CSV');
                setDatasetName('Atacama & Rio Tinto Sample CSV');
                setCsvContent(SAMPLE_CSV_TEMPLATE);
              }}
              className="font-mono text-[11px] text-sky-400 hover:text-cyan-300 cursor-pointer"
            >
              Load Sample CSV Schema
            </button>
          }
        >
          <form onSubmit={handleIngestSubmit} className="space-y-3.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="ingest-dataset-name"
                  className="block font-mono text-[10px] uppercase tracking-wider text-slate-500 mb-1"
                >
                  Dataset Name
                </label>
                <input
                  id="ingest-dataset-name"
                  type="text"
                  value={datasetName}
                  onChange={(e) => setDatasetName(e.target.value)}
                  className="w-full rounded-lg bg-[#04060A] border border-white/10 focus:border-cyan-400 focus:outline-none px-3 py-1.5 font-mono text-xs text-slate-100"
                />
              </div>
              <div>
                <label
                  htmlFor="ingest-agency"
                  className="block font-mono text-[10px] uppercase tracking-wider text-slate-500 mb-1"
                >
                  Source Agency / Lab
                </label>
                <input
                  id="ingest-agency"
                  type="text"
                  value={agency}
                  onChange={(e) => setAgency(e.target.value)}
                  className="w-full rounded-lg bg-[#04060A] border border-white/10 focus:border-cyan-400 focus:outline-none px-3 py-1.5 font-mono text-xs text-slate-100"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 bg-[#04060A] p-1 rounded-lg border border-white/[0.06]">
                {(['CSV', 'JSON'] as const).map((fmt) => (
                  <button
                    key={fmt}
                    type="button"
                    onClick={() => setFormat(fmt)}
                    className={`px-2.5 py-1 rounded-md font-mono text-[11px] cursor-pointer ${
                      format === fmt
                        ? 'bg-cyan-400/20 text-cyan-300 font-semibold'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {fmt}
                  </button>
                ))}
              </div>

              <label className="px-3 py-1.5 rounded-lg bg-white/[0.05] border border-white/10 hover:border-cyan-400/60 font-mono text-[11px] text-slate-200 inline-flex items-center gap-1.5 cursor-pointer">
                <Upload className="w-3.5 h-3.5 text-sky-400" />
                <span>Select File (.csv / .json)</span>
                <input
                  type="file"
                  accept=".csv,.json,text/csv,application/json"
                  onChange={handleFileRead}
                  className="hidden"
                />
              </label>
            </div>

            <div>
              <label
                htmlFor="ingest-payload"
                className="block font-mono text-[10px] uppercase tracking-wider text-slate-500 mb-1"
              >
                Dataset Payload (Missing cells preserved as NA / null — never zero-filled)
              </label>
              <textarea
                id="ingest-payload"
                rows={5}
                value={csvContent}
                onChange={(e) => setCsvContent(e.target.value)}
                placeholder="site_name,country,lat,lon,elevation_m,slope_deg,surface_temp_k,precipitation_mm_yr,solar_irradiance_wm2"
                className="w-full rounded-xl bg-[#04060A] border border-white/10 focus:border-cyan-400 focus:outline-none p-3 font-mono text-[11px] text-slate-100 placeholder:text-slate-600"
              />
            </div>

            {ingestFeedback && (
              <div
                className={`p-3 rounded-xl border font-mono text-xs ${
                  ingestFeedback.ok
                    ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-300'
                    : 'border-rose-400/40 bg-rose-500/10 text-rose-300'
                }`}
              >
                {ingestFeedback.text}
              </div>
            )}

            <button
              type="submit"
              disabled={isIngesting}
              className="w-full py-2.5 rounded-xl bg-cyan-400 text-slate-950 hover:bg-cyan-300 font-display text-xs font-semibold tracking-wide cursor-pointer disabled:opacity-50 transition-colors"
            >
              {isIngesting ? 'Validating & Indexing...' : 'Validate & Register Dataset'}
            </button>
          </form>
        </ModuleCard>

        <ModuleCard title="External NASA Data Service Interfaces" className="lg:col-span-6">
          <div className="space-y-5">
            <div className="space-y-3 pb-4 border-b border-white/[0.07]">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Globe2 className="w-4 h-4 text-cyan-400" />
                  <span className="font-display text-sm font-semibold text-white">
                    NASA POWER Climatology API
                  </span>
                </div>
                <StatusIndicator tone="cyan" label="REST Adapter Ready" />
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Queries <code className="text-sky-400">power.larc.nasa.gov</code> for 2m air temp
                (T2M), precipitation (PRECTOTCORR), and shortwave flux (ALLSKY_SFC_SW_DWN). Fails
                gracefully when offline without fabricating telemetry.
              </p>
              <div className="flex flex-wrap items-end gap-2">
                <div className="flex-1 min-w-[100px]">
                  <label
                    htmlFor="power-lat"
                    className="block font-mono text-[10px] uppercase text-slate-500 mb-1"
                  >
                    Lat (°)
                  </label>
                  <input
                    id="power-lat"
                    type="text"
                    value={queryLat}
                    onChange={(e) => setQueryLat(e.target.value)}
                    className="w-full rounded-lg bg-[#04060A] border border-white/10 px-2.5 py-1.5 font-mono text-xs text-slate-100"
                  />
                </div>
                <div className="flex-1 min-w-[100px]">
                  <label
                    htmlFor="power-lon"
                    className="block font-mono text-[10px] uppercase text-slate-500 mb-1"
                  >
                    Lon (°)
                  </label>
                  <input
                    id="power-lon"
                    type="text"
                    value={queryLon}
                    onChange={(e) => setQueryLon(e.target.value)}
                    className="w-full rounded-lg bg-[#04060A] border border-white/10 px-2.5 py-1.5 font-mono text-xs text-slate-100"
                  />
                </div>
                <button
                  type="button"
                  onClick={handlePowerQuery}
                  disabled={powerLoading}
                  className="px-3.5 py-1.5 rounded-lg bg-cyan-400/15 border border-cyan-400/40 text-cyan-300 hover:bg-cyan-400 hover:text-slate-950 font-mono text-xs cursor-pointer whitespace-nowrap transition-colors"
                >
                  {powerLoading ? 'Querying...' : 'Query NASA POWER'}
                </button>
              </div>
              {powerResult && (
                <pre className="rounded-xl bg-[#04060A] border border-white/[0.07] p-3 font-mono text-[10px] text-slate-300 max-h-36 overflow-auto">
                  {JSON.stringify(powerResult, null, 2)}
                </pre>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <span className="font-display text-xs font-semibold text-white inline-flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5 text-sky-400" />
                  NASA Earthdata / AppEEARS
                </span>
                <div>
                  <StatusIndicator tone="amber" label="Token / Async Job Queue" />
                </div>
                <p className="text-[11px] text-slate-400 leading-snug pt-0.5">
                  MODIS MOD11A2 & NASADEM products require Earthdata Login bearer tokens and
                  asynchronous spatial subsetting jobs.
                </p>
              </div>

              <div className="space-y-1.5">
                <span className="font-display text-xs font-semibold text-white inline-flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5 text-sky-400" />
                  PDS / Orbital Data Explorer
                </span>
                <div>
                  <StatusIndicator tone="nominal" label="Local Raster Ready" />
                </div>
                <p className="text-[11px] text-slate-400 leading-snug pt-0.5">
                  LOLA, Diviner, MOLA, and THEMIS PDS4/GeoTIFF products are indexed via ODE
                  footprints and cached locally for deterministic offline analysis.
                </p>
              </div>
            </div>
          </div>
        </ModuleCard>
      </div>
    </div>
  );
};
