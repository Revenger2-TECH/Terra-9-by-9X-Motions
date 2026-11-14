import React, { useState } from 'react';
import { Download, FileJson, FileText, PlusCircle } from 'lucide-react';
import { jsPDF } from 'jspdf';
import type { AnalysisRunRecord, MissionReport } from '../engine/types';
import { ModuleCard, SegmentedMetricBar, StatusIndicator } from './TelemetryPrimitives';

interface MissionReportsViewProps {
  reports: MissionReport[];
  selectedReportId: string | null;
  onSelectReport: (reportId: string) => void;
  latestAnalysis: AnalysisRunRecord | null;
  selectedSiteId: string;
  onGenerateReport: (analysisId: string, siteId: string) => Promise<void>;
}

function exportReportPdf(report: MissionReport) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const margin = 44;
  let y = 48;
  const maxWidth = 507;

  const writeLine = (
    text: string,
    size = 10,
    bold = false,
    color: [number, number, number] = [30, 41, 59]
  ) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    doc.setTextColor(...color);
    const lines = doc.splitTextToSize(text, maxWidth);
    for (const line of lines) {
      if (y > 780) {
        doc.addPage();
        y = 48;
      }
      doc.text(line, margin, y);
      y += size + 5;
    }
  };

  writeLine('TERRA-9 // EARTH ANALOG INTELLIGENCE SYSTEM', 14, true, [0, 98, 110]);
  writeLine(
    'Developed by 9X MOTIONS — Beyond Earth. Grounded in Data. Driven by Discovery.',
    9,
    false,
    [100, 116, 139]
  );
  y += 8;

  writeLine(`SCIENTIFIC ANALOG DOSSIER: ${report.reportId}`, 12, true, [15, 23, 42]);
  writeLine(
    `Generated UTC: ${report.createdAtUtc} | Analysis ID: ${report.analysisId}`,
    9,
    false,
    [71, 85, 105]
  );
  y += 8;

  writeLine(`Planetary Target: ${report.targetName} (${report.targetBody})`, 10, true);
  writeLine(`Terrestrial Candidate: ${report.siteName}, ${report.country}`, 10, true);
  writeLine(
    `Relative Similarity Index: ${
      report.overallSimilarityScore !== null
        ? `${(report.overallSimilarityScore * 100).toFixed(1)}% (${report.overallSimilarityScore.toFixed(4)})`
        : 'INSUFFICIENT DATA'
    } | Rank: ${report.rank ? `#${report.rank} of ${report.totalCandidatesEvaluated}` : 'Unranked'}`,
    10
  );
  writeLine(
    `Data Coverage: ${(report.coverageRatio * 100).toFixed(0)}% | Confidence Level: ${report.confidenceLevel} | Temp Mode: ${report.temperatureMode}`,
    9
  );
  y += 10;

  writeLine('FEATURE-LEVEL COMPARISON', 11, true, [0, 98, 110]);
  for (const row of report.featureComparisons) {
    const pText =
      row.planetaryValue !== null
        ? `${row.planetaryValue} ${row.planetaryUnit}`
        : 'DATA UNAVAILABLE';
    const eText =
      row.earthValue !== null ? `${row.earthValue} ${row.earthUnit}` : 'DATA UNAVAILABLE';
    const simText =
      row.similarityContribution !== null
        ? `${(row.similarityContribution * 100).toFixed(1)}%`
        : 'EXCLUDED';
    writeLine(
      `${row.label}: Target=${pText} | Earth=${eText} | Status=${row.compatibilityStatus} | EffWt=${(row.effectiveWeight * 100).toFixed(1)}% | Sim=${simText}`,
      9
    );
  }
  y += 8;

  writeLine('METHODOLOGY', 11, true, [0, 98, 110]);
  writeLine(report.methodologySummary, 9);
  y += 8;

  writeLine('SCIENTIFIC LIMITATIONS & CAVEATS', 11, true, [180, 83, 9]);
  for (const lim of report.scientificLimitations) {
    writeLine(`- ${lim}`, 9);
  }
  y += 8;

  writeLine('DATASET PROVENANCE REFERENCES', 11, true, [0, 98, 110]);
  for (const ref of report.sourceReferences) {
    writeLine(`- ${ref}`, 8, false, [71, 85, 105]);
  }

  doc.save(`${report.reportId}_${report.siteId}_dossier.pdf`);
}

function exportReportJson(report: MissionReport) {
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${report.reportId}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export const MissionReportsView: React.FC<MissionReportsViewProps> = ({
  reports,
  selectedReportId,
  onSelectReport,
  latestAnalysis,
  selectedSiteId,
  onGenerateReport,
}) => {
  const [generating, setGenerating] = useState(false);

  const activeReport =
    reports.find((r) => r.reportId === selectedReportId) ?? reports[0] ?? null;

  const handleCreateFromCurrent = async () => {
    if (!latestAnalysis) return;
    setGenerating(true);
    try {
      await onGenerateReport(latestAnalysis.analysisId, selectedSiteId);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
      <ModuleCard
        title="Generated Dossiers"
        className="lg:col-span-4"
        rightSlot={
          <span className="font-mono text-xs text-slate-400 tabular-nums">
            {reports.length} saved
          </span>
        }
      >
        <div className="space-y-4">
          <button
            type="button"
            disabled={!latestAnalysis || generating}
            onClick={handleCreateFromCurrent}
            className="w-full py-2.5 px-4 rounded-xl bg-cyan-400 text-slate-950 hover:bg-cyan-300 font-display text-xs font-semibold tracking-wide flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 transition-colors"
          >
            <PlusCircle className="w-4 h-4" />
            <span>
              {generating ? 'Generating Dossier...' : 'Generate from Latest Analysis'}
            </span>
          </button>

          {reports.length === 0 ? (
            <div className="py-6 text-xs text-slate-400 leading-relaxed">
              No mission dossiers generated in this session yet. Click above or generate a report
              directly from Comparative Analysis.
            </div>
          ) : (
            <div className="divide-y divide-white/[0.06]">
              {reports.map((rep) => {
                const isSelected = rep.reportId === activeReport?.reportId;
                return (
                  <button
                    key={rep.reportId}
                    type="button"
                    onClick={() => onSelectReport(rep.reportId)}
                    className={`w-full text-left p-3 rounded-xl transition-colors cursor-pointer ${
                      isSelected ? 'bg-cyan-400/10' : 'hover:bg-white/[0.03]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 font-mono text-[10px]">
                      <span className="text-cyan-400 font-semibold">{rep.reportId}</span>
                      <span className="text-slate-500">
                        {rep.createdAtUtc.slice(11, 19)} UTC
                      </span>
                    </div>
                    <div className="text-xs font-semibold text-white mt-1">
                      {rep.targetName} vs {rep.siteName}
                    </div>
                    <div className="font-mono text-[11px] text-slate-400 mt-0.5 tabular-nums">
                      Score:{' '}
                      {rep.overallSimilarityScore !== null
                        ? `${(rep.overallSimilarityScore * 100).toFixed(1)}%`
                        : 'INSUFFICIENT'}{' '}
                      · Confidence: {rep.confidenceLevel}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </ModuleCard>

      <ModuleCard
        title="Mission Report Dossier"
        className="lg:col-span-8"
        rightSlot={
          activeReport && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => exportReportJson(activeReport)}
                className="px-3 py-1.5 rounded-lg bg-white/[0.05] border border-white/10 hover:border-sky-400 text-slate-100 font-mono text-[11px] inline-flex items-center gap-1.5 cursor-pointer"
              >
                <FileJson className="w-3.5 h-3.5 text-sky-400" />
                JSON
              </button>
              <button
                type="button"
                onClick={() => exportReportPdf(activeReport)}
                className="px-3 py-1.5 rounded-lg bg-cyan-400 text-slate-950 hover:bg-cyan-300 font-display text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                Export PDF
              </button>
            </div>
          )
        }
      >
        {!activeReport ? (
          <div className="py-16 text-center space-y-2">
            <FileText className="w-8 h-8 text-slate-600 mx-auto" />
            <div className="font-mono text-xs text-slate-400">
              Select or generate a scientific dossier to inspect complete traceability records.
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-white/[0.07]">
              <div className="space-y-1">
                <div className="font-mono text-[11px] text-cyan-400">
                  TERRA-9 · 9X MOTIONS · REPORT {activeReport.reportId}
                </div>
                <h3 className="font-display text-xl font-semibold text-white">
                  {activeReport.targetName} ({activeReport.targetBody}) — {activeReport.siteName},{' '}
                  {activeReport.country}
                </h3>
                <div className="font-mono text-[11px] text-slate-400 tabular-nums">
                  Analysis: {activeReport.analysisId} · {activeReport.createdAtUtc}
                </div>
              </div>
              <StatusIndicator
                tone={
                  activeReport.confidenceLevel === 'HIGH'
                    ? 'nominal'
                    : activeReport.confidenceLevel === 'INSUFFICIENT'
                    ? 'error'
                    : 'amber'
                }
                label={`Confidence: ${activeReport.confidenceLevel}`}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-white/[0.07] font-mono">
              <div className="pb-3 sm:pb-0 sm:pr-4 space-y-1.5">
                <div className="text-[10px] uppercase text-slate-500">Relative Similarity</div>
                <SegmentedMetricBar value={activeReport.overallSimilarityScore} segments={14} />
              </div>
              <div className="py-3 sm:py-0 sm:px-4">
                <div className="text-[10px] uppercase text-slate-500">Candidate Ranking</div>
                <div className="text-lg font-semibold text-white tabular-nums mt-1">
                  {activeReport.rank
                    ? `#${activeReport.rank} / ${activeReport.totalCandidatesEvaluated}`
                    : 'UNRANKED'}
                </div>
              </div>
              <div className="pt-3 sm:pt-0 sm:pl-4">
                <div className="text-[10px] uppercase text-slate-500">Feature Coverage</div>
                <div className="text-lg font-semibold text-sky-400 tabular-nums mt-1">
                  {(activeReport.coverageRatio * 100).toFixed(0)}%
                </div>
              </div>
            </div>

            <div className="overflow-x-auto border-y border-white/[0.07]">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/[0.08] font-mono text-[10px] uppercase tracking-wider text-slate-500">
                    <th className="py-2.5 pr-3">Parameter</th>
                    <th className="py-2.5 pr-3">Target</th>
                    <th className="py-2.5 pr-3">Earth Site</th>
                    <th className="py-2.5 pr-3">Compatibility</th>
                    <th className="py-2.5 text-right">Similarity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.05] text-xs font-mono">
                  {activeReport.featureComparisons.map((fc) => (
                    <tr key={fc.feature}>
                      <td className="py-2.5 pr-3 font-sans text-slate-100">{fc.label}</td>
                      <td className="py-2.5 pr-3 tabular-nums text-slate-400">
                        {fc.planetaryValue !== null
                          ? `${fc.planetaryValue} ${fc.planetaryUnit}`
                          : 'DATA UNAVAILABLE'}
                      </td>
                      <td className="py-2.5 pr-3 tabular-nums text-slate-400">
                        {fc.earthValue !== null
                          ? `${fc.earthValue} ${fc.earthUnit}`
                          : 'DATA UNAVAILABLE'}
                      </td>
                      <td className="py-2.5 pr-3 text-[10px] text-sky-400">
                        {fc.compatibilityStatus}
                      </td>
                      <td className="py-2.5 text-right tabular-nums text-cyan-300">
                        {fc.similarityContribution !== null
                          ? `${(fc.similarityContribution * 100).toFixed(1)}%`
                          : 'EXCLUDED'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <h4 className="font-mono text-[11px] uppercase tracking-wider text-sky-400">
                  Methodology Statement
                </h4>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {activeReport.methodologySummary}
                </p>
              </div>

              <div className="space-y-2">
                <h4 className="font-mono text-[11px] uppercase tracking-wider text-amber-400">
                  Scientific Limitations & Disclosures
                </h4>
                <ul className="space-y-1 text-xs text-slate-300 list-disc pl-4">
                  {activeReport.scientificLimitations.map((lim, idx) => (
                    <li key={idx}>{lim}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="pt-3 border-t border-white/[0.07] space-y-1.5">
              <h4 className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                Dataset & Provenance References
              </h4>
              <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-sky-400">
                {activeReport.sourceReferences.map((ref, idx) => (
                  <span key={idx} className="break-all">
                    {ref}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </ModuleCard>
    </div>
  );
};
