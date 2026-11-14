import React from 'react';
import { FEATURE_SCALES, METHODOLOGY_VERSION } from '../engine/similarity';
import { ModuleCard, StatusIndicator } from './TelemetryPrimitives';

export const SystemInformationView: React.FC = () => {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <ModuleCard
          title="TERRA-9 System Architecture & Identity"
          className="lg:col-span-6"
          rightSlot={<StatusIndicator tone="cyan" label={METHODOLOGY_VERSION} />}
        >
          <div className="space-y-4 text-xs text-slate-300 leading-relaxed">
            <div className="pb-3 border-b border-white/[0.07] space-y-1">
              <div className="font-display text-lg font-semibold text-white">
                TERRA-9 — Earth Analog Intelligence System
              </div>
              <div className="font-mono text-xs text-cyan-400">
                Developed by 9X MOTIONS · Beyond Earth. Grounded in Data. Driven by Discovery.
              </div>
              <div className="font-mono text-[11px] text-slate-500">
                Context: NASA Space Apps Challenge 2026 (Independent research platform; no NASA
                endorsement implied).
              </div>
            </div>

            <p>
              TERRA-9 separates interactive spatial visualization (React, TypeScript, Framer Motion,
              Plotly, Leaflet), backend REST services (Express), and a deterministic,
              unit-verified similarity intelligence core.
            </p>

            <div className="space-y-1.5 font-mono text-[11px]">
              <div className="text-sky-400 uppercase text-[10px]">Implemented REST Endpoints</div>
              <div className="rounded-xl bg-[#04060A] border border-white/[0.06] p-3.5 space-y-1 text-slate-400">
                <div>GET  /api/health</div>
                <div>GET  /api/targets</div>
                <div>GET  /api/datasets</div>
                <div>POST /api/datasets/ingest</div>
                <div>GET  /api/earth-sites</div>
                <div>POST /api/analysis/run</div>
                <div>GET  /api/analysis/:analysisId</div>
                <div>GET  /api/analysis/:analysisId/explanation</div>
                <div>POST /api/reports/generate</div>
                <div>GET  /api/reports/:reportId</div>
                <div>GET  /api/external/nasa-power</div>
              </div>
            </div>
          </div>
        </ModuleCard>

        <ModuleCard title="Explainable Similarity Engine Specification" className="lg:col-span-6">
          <div className="space-y-4 text-xs text-slate-300 leading-relaxed">
            <p>
              TERRA-9 does <strong className="text-white">not</strong> use opaque neural networks or
              claim trained AI predictions. It computes a reproducible weighted feature-distance
              index across validated physical parameters:
            </p>

            <div className="rounded-xl bg-[#04060A] border border-white/[0.06] p-3.5 font-mono text-[11px] text-slate-100 space-y-1">
              <div>d_i = min(1, |x_target,i - x_earth,i| / S_i)</div>
              <div>sim_i = 1 - d_i</div>
              <div>w_eff,i = w_i / SUM(w_k for k in comparable_features)</div>
              <div className="text-cyan-400">Score = SUM(w_eff,i * sim_i)</div>
            </div>

            <div className="overflow-x-auto border-y border-white/[0.07]">
              <table className="w-full text-left border-collapse font-mono text-[11px]">
                <thead>
                  <tr className="border-b border-white/[0.08] text-[10px] text-slate-500 uppercase">
                    <th className="py-2">Feature</th>
                    <th className="py-2 text-right">Calibration Span (S_i)</th>
                    <th className="py-2 text-right">Unit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.05]">
                  {Object.entries(FEATURE_SCALES).map(([key, spec]) => (
                    <tr key={key}>
                      <td className="py-2 text-slate-100">{spec.label}</td>
                      <td className="py-2 text-right tabular-nums text-sky-400">{spec.maxSpan}</td>
                      <td className="py-2 text-right text-slate-400">{spec.unit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </ModuleCard>
      </div>

      <ModuleCard title="Data Integrity & Scientific Responsibility Charter">
        <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-white/[0.07] text-xs text-slate-300 leading-relaxed">
          <div className="pb-4 md:pb-0 md:pr-5 space-y-1.5">
            <div className="font-mono text-[11px] uppercase tracking-wider text-cyan-400">
              1. Measurement Type Enforcement
            </div>
            <p>
              Earth 2-meter atmospheric air temperature (°C from NASA POWER) is never silently
              compared against Lunar Diviner or Martian THEMIS surface radiometric skin
              temperature (K). Only MODIS MOD11A2 radiative skin LST is permitted in thermal
              scoring, with explicit physical caveats.
            </p>
          </div>
          <div className="py-4 md:py-0 md:px-5 space-y-1.5">
            <div className="font-mono text-[11px] uppercase tracking-wider text-amber-400">
              2. Zero-Imputation Prohibition
            </div>
            <p>
              Missing or masked observations (such as MODIS LST over Salar de Uyuni seasonal brine
              or Lunar vacuum precipitation) are never coerced to zero. Excluded features are
              disclosed and weights are renormalized strictly across valid comparable channels.
            </p>
          </div>
          <div className="pt-4 md:pt-0 md:pl-5 space-y-1.5">
            <div className="font-mono text-[11px] uppercase tracking-wider text-emerald-400">
              3. Illustrative vs Observational Separation
            </div>
            <p>
              Visual reference renders are explicitly labeled as illustrative orbital context.
              Unavailable hyperspectral cubes display DATA UNAVAILABLE rather than synthetic
              mineral maps. Similarity scores represent relative numerical distance, never planetary
              equivalence.
            </p>
          </div>
        </div>
      </ModuleCard>
    </div>
  );
};
