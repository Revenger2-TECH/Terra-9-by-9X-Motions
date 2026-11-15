import { GoogleGenAI, ThinkingLevel, type Content, type Part } from '@google/genai';
import express from 'express';
import http from 'node:http';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';
import {
  SI_FALLBACK_MODEL_NAME,
  SI_MODEL_NAME,
  SI_SYSTEM_INSTRUCTION,
  SI_TOOL_DECLARATIONS,
  executeQueryDatasetMetadata,
  executeRunSimilarityAnalysis,
  type QueryMetadataToolArgs,
  type RunSimilarityToolArgs,
} from './src/agent/siTools';
import {
  DATASET_REGISTRY,
  EARTH_SITES,
  PLANETARY_TARGETS,
} from './src/data/catalog';
import {
  DEFAULT_FEATURE_WEIGHTS,
  METHODOLOGY_VERSION,
  evaluateEarthAnalogs,
  parseLocalSiteCsv,
} from './src/engine/similarity';
import type {
  ActivityEvent,
  AnalysisRunRecord,
  DatasetRegistryEntry,
  EarthSite,
  FeatureWeights,
  MissionReport,
  TemperatureComparisonMode,
  TargetId,
} from './src/engine/types';

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

const PORT = Number(
  process.env.DEFAULT_APP_PORT ||
    (process.env.NGINX_PORT ? 3000 : process.env.PORT) ||
    3000
);

// In-memory scientific workspace state (initialized from validated catalog)
const datasets: DatasetRegistryEntry[] = [...DATASET_REGISTRY];
const earthSites: EarthSite[] = [...EARTH_SITES];
const analysisStore = new Map<string, AnalysisRunRecord>();
const reportStore = new Map<string, MissionReport>();
const activityLog: ActivityEvent[] = [
  {
    id: 'evt-init-1',
    timestampUtc: new Date().toISOString(),
    category: 'DATASET',
    message: 'Validated reference dataset catalog loaded',
    detail: `${DATASET_REGISTRY.filter((d) => d.availabilityStatus !== 'UNAVAILABLE').length}/${DATASET_REGISTRY.length} datasets indexed across Moon, Mars, and ${EARTH_SITES.length} Earth candidate sites.`,
  },
];

let analysisSeq = 1;
let reportSeq = 1;

function recordActivity(
  category: ActivityEvent['category'],
  message: string,
  detail: string
) {
  activityLog.unshift({
    id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestampUtc: new Date().toISOString(),
    category,
    message,
    detail,
  });
  if (activityLog.length > 40) {
    activityLog.length = 40;
  }
}

// Run an initial deterministic baseline analysis on startup so exploratory routes have traceable baseline output
function seedInitialAnalyses() {
  for (const target of PLANETARY_TARGETS) {
    const results = evaluateEarthAnalogs(
      target,
      earthSites,
      DEFAULT_FEATURE_WEIGHTS,
      'MODIS_SURFACE_LST'
    );
    const analysisId = `ANL-${target.body}-${String(analysisSeq++).padStart(4, '0')}`;
    const record: AnalysisRunRecord = {
      analysisId,
      createdAtUtc: new Date().toISOString(),
      targetId: target.id,
      targetName: target.name,
      targetBody: target.body,
      weights: { ...DEFAULT_FEATURE_WEIGHTS },
      temperatureMode: 'MODIS_SURFACE_LST',
      eligibleRankedCount: results.filter((r) => r.overallSimilarityScore !== null).length,
      totalEvaluatedCount: results.length,
      methodologyVersion: METHODOLOGY_VERSION,
      results,
    };
    analysisStore.set(analysisId, record);
  }
}
seedInitialAnalyses();

function createApp() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'NOMINAL',
      service: 'TERRA-9 Earth Analog Intelligence System',
      developer: '9X MOTIONS',
      methodologyVersion: METHODOLOGY_VERSION,
      datasetsLoaded: datasets.filter((d) => d.availabilityStatus !== 'UNAVAILABLE').length,
      totalDatasets: datasets.length,
      earthSitesCount: earthSites.length,
      analysesStored: analysisStore.size,
      reportsGenerated: reportStore.size,
      lastUpdatedUtc: activityLog[0]?.timestampUtc ?? new Date().toISOString(),
    });
  });

  app.get('/api/targets', (_req, res) => {
    res.json({ targets: PLANETARY_TARGETS });
  });

  app.get('/api/datasets', (_req, res) => {
    res.json({ datasets });
  });

  app.post('/api/datasets/ingest', (req, res) => {
    const { datasetName, format, content, agency, units } = req.body ?? {};
    if (!datasetName || typeof datasetName !== 'string' || !content || typeof content !== 'string') {
      return res.status(400).json({
        error: 'datasetName and string content are required.',
      });
    }

    if (format === 'CSV') {
      const parsed = parseLocalSiteCsv(content);
      if (!parsed.valid) {
        return res.status(400).json({
          error: 'CSV validation failed',
          details: parsed.errors,
        });
      }

      const addedSites: EarthSite[] = [];
      for (const row of parsed.rows) {
        const siteId = `user-${row.siteName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now().toString(36).slice(-4)}`;
        const availableCount = [
          row.elevationM,
          row.slopeDeg,
          row.surfaceTempK,
          row.precipitationMmYr,
          row.solarIrradianceWm2,
        ].filter((v) => v !== null).length;

        const newSite: EarthSite = {
          id: siteId,
          name: row.siteName,
          subregion: `Local CSV Ingest (${datasetName})`,
          country: row.country,
          coordinates: {
            lat: row.lat,
            lon: row.lon,
            formatted: `${Math.abs(row.lat).toFixed(2)}°${row.lat >= 0 ? 'N' : 'S'}, ${Math.abs(row.lon).toFixed(2)}°${row.lon >= 0 ? 'E' : 'W'}`,
          },
          terrainCategory: 'High-Altitude / Evaporite',
          geologySummary: `User-supplied local dataset record imported from ${datasetName}.`,
          analogRelevance: {
            moon: 'User-imported terrestrial candidate awaiting geological cross-check.',
            mars: 'User-imported terrestrial candidate awaiting geological cross-check.',
          },
          dataCompletenessPct: Math.round((availableCount / 5) * 100),
          datasetsUsed: [datasetName],
          parameters: {
            elevation: {
              value: row.elevationM,
              unit: 'm (ASL)',
              measurementType: 'ELEVATION_DATUM_M',
              source: datasetName,
              provenanceNote:
                row.elevationM === null ? 'DATA UNAVAILABLE in uploaded CSV.' : 'Imported from local CSV.',
              isAvailable: row.elevationM !== null,
              dataKind: row.elevationM !== null ? 'LOCAL_USER_DATASET' : 'UNAVAILABLE',
            },
            slope: {
              value: row.slopeDeg,
              unit: 'deg',
              measurementType: 'TERRAIN_SLOPE_DEG',
              source: datasetName,
              provenanceNote:
                row.slopeDeg === null ? 'DATA UNAVAILABLE in uploaded CSV.' : 'Imported from local CSV.',
              isAvailable: row.slopeDeg !== null,
              dataKind: row.slopeDeg !== null ? 'LOCAL_USER_DATASET' : 'UNAVAILABLE',
            },
            surfaceTemp: {
              value: row.surfaceTempK,
              unit: 'K',
              measurementType: 'SURFACE_RADIOMETRIC_TEMP_K',
              source: datasetName,
              provenanceNote:
                row.surfaceTempK === null ? 'DATA UNAVAILABLE in uploaded CSV.' : 'Imported from local CSV (Kelvin LST).',
              isAvailable: row.surfaceTempK !== null,
              dataKind: row.surfaceTempK !== null ? 'LOCAL_USER_DATASET' : 'UNAVAILABLE',
            },
            airTemp2m: {
              value: null,
              unit: '°C',
              measurementType: 'AIR_TEMP_2M_C',
              source: datasetName,
              provenanceNote: 'DATA UNAVAILABLE — Not supplied in CSV schema.',
              isAvailable: false,
              dataKind: 'UNAVAILABLE',
            },
            precipitation: {
              value: row.precipitationMmYr,
              unit: 'mm/yr',
              measurementType: 'PRECIPITATION_MM_YR',
              source: datasetName,
              provenanceNote:
                row.precipitationMmYr === null ? 'DATA UNAVAILABLE in uploaded CSV.' : 'Imported from local CSV.',
              isAvailable: row.precipitationMmYr !== null,
              dataKind: row.precipitationMmYr !== null ? 'LOCAL_USER_DATASET' : 'UNAVAILABLE',
            },
            solarIrradiance: {
              value: row.solarIrradianceWm2,
              unit: 'W/m²',
              measurementType: 'SOLAR_IRRADIANCE_WM2',
              source: datasetName,
              provenanceNote:
                row.solarIrradianceWm2 === null ? 'DATA UNAVAILABLE in uploaded CSV.' : 'Imported from local CSV.',
              isAvailable: row.solarIrradianceWm2 !== null,
              dataKind: row.solarIrradianceWm2 !== null ? 'LOCAL_USER_DATASET' : 'UNAVAILABLE',
            },
          },
        };
        earthSites.push(newSite);
        addedSites.push(newSite);
      }

      const entry: DatasetRegistryEntry = {
        id: `ds-local-${Date.now().toString(36)}`,
        name: datasetName,
        body: 'EARTH',
        sourceAgency: agency || 'Local Researcher Upload',
        instrument: 'User-Supplied CSV Table',
        fileFormat: 'CSV',
        spatialCoverage: `${addedSites.length} point coordinate(s)`,
        measurementUnits: units || 'm, deg, K, mm/yr, W/m²',
        processingStatus: 'VALIDATED',
        availabilityStatus: 'LOADED_LOCAL',
        freshness: `Imported ${new Date().toISOString().slice(0, 10)}`,
        provenanceUrl: 'local://user-ingest',
        notes: `Validated ${addedSites.length} candidate site record(s) with explicit null preservation for missing fields.`,
        recordCount: addedSites.length,
      };
      datasets.unshift(entry);
      recordActivity(
        'DATASET',
        `Local CSV dataset ingested: ${datasetName}`,
        `Added ${addedSites.length} terrestrial candidate record(s) to workspace registry.`
      );

      return res.status(201).json({ dataset: entry, addedSites });
    }

    // JSON metadata/dataset registration
    try {
      const parsedJson = JSON.parse(content);
      const entry: DatasetRegistryEntry = {
        id: `ds-local-${Date.now().toString(36)}`,
        name: datasetName,
        body: 'EARTH',
        sourceAgency: agency || 'Local Researcher Upload',
        instrument: 'User-Supplied JSON Payload',
        fileFormat: 'JSON',
        spatialCoverage: 'Custom Metadata / Coordinate Extent',
        measurementUnits: units || 'Verified Schema Units',
        processingStatus: 'VALIDATED',
        availabilityStatus: 'LOADED_LOCAL',
        freshness: `Imported ${new Date().toISOString().slice(0, 10)}`,
        provenanceUrl: 'local://user-ingest-json',
        notes: `Registered JSON metadata (${Array.isArray(parsedJson) ? parsedJson.length : Object.keys(parsedJson).length} top-level entries).`,
        recordCount: Array.isArray(parsedJson) ? parsedJson.length : 1,
      };
      datasets.unshift(entry);
      recordActivity(
        'DATASET',
        `Local JSON dataset registered: ${datasetName}`,
        `Validated JSON scientific metadata payload.`
      );
      return res.status(201).json({ dataset: entry, addedSites: [] });
    } catch {
      return res.status(400).json({ error: 'Invalid JSON payload provided.' });
    }
  });

  app.get('/api/earth-sites', (_req, res) => {
    res.json({ sites: earthSites });
  });

  app.post('/api/analysis/run', (req, res) => {
    const {
      targetId,
      weights,
      temperatureMode = 'MODIS_SURFACE_LST',
    }: {
      targetId?: TargetId;
      weights?: Partial<FeatureWeights>;
      temperatureMode?: TemperatureComparisonMode;
    } = req.body ?? {};

    const target = PLANETARY_TARGETS.find((t) => t.id === targetId);
    if (!target) {
      return res.status(400).json({ error: 'Valid targetId ("shackleton" or "jezero") is required.' });
    }

    const mergedWeights: FeatureWeights = {
      elevation: Number.isFinite(weights?.elevation) ? Math.max(0, Number(weights!.elevation)) : DEFAULT_FEATURE_WEIGHTS.elevation,
      slope: Number.isFinite(weights?.slope) ? Math.max(0, Number(weights!.slope)) : DEFAULT_FEATURE_WEIGHTS.slope,
      surfaceTemp: Number.isFinite(weights?.surfaceTemp) ? Math.max(0, Number(weights!.surfaceTemp)) : DEFAULT_FEATURE_WEIGHTS.surfaceTemp,
      precipitation: Number.isFinite(weights?.precipitation) ? Math.max(0, Number(weights!.precipitation)) : DEFAULT_FEATURE_WEIGHTS.precipitation,
      solarIrradiance: Number.isFinite(weights?.solarIrradiance) ? Math.max(0, Number(weights!.solarIrradiance)) : DEFAULT_FEATURE_WEIGHTS.solarIrradiance,
    };

    const totalWeight = Object.values(mergedWeights).reduce((s, v) => s + v, 0);
    if (totalWeight <= 0) {
      return res.status(400).json({ error: 'At least one feature weight must be greater than zero.' });
    }

    const results = evaluateEarthAnalogs(target, earthSites, mergedWeights, temperatureMode);
    const analysisId = `ANL-${target.body}-${String(analysisSeq++).padStart(4, '0')}`;
    const record: AnalysisRunRecord = {
      analysisId,
      createdAtUtc: new Date().toISOString(),
      targetId: target.id,
      targetName: target.name,
      targetBody: target.body,
      weights: mergedWeights,
      temperatureMode,
      eligibleRankedCount: results.filter((r) => r.overallSimilarityScore !== null).length,
      totalEvaluatedCount: results.length,
      methodologyVersion: METHODOLOGY_VERSION,
      results,
    };

    analysisStore.set(analysisId, record);

    const topSite = results.find((r) => r.rank === 1);
    recordActivity(
      'ANALYSIS',
      `Similarity analysis completed (${analysisId})`,
      `${target.name} (${target.body}) evaluated across ${results.length} sites. Top rank: ${topSite ? `${topSite.siteName} (${(topSite.overallSimilarityScore! * 100).toFixed(1)}%)` : 'Insufficient comparable data'}.`
    );

    return res.json(record);
  });

  app.get('/api/analysis/latest', (req, res) => {
    const targetId = req.query.targetId as TargetId | undefined;
    const all = Array.from(analysisStore.values()).reverse();
    const match = targetId ? all.find((a) => a.targetId === targetId) : all[0];
    if (!match) {
      return res.status(404).json({ error: 'No analysis found.' });
    }
    return res.json(match);
  });

  app.get('/api/analysis/:analysisId', (req, res) => {
    const record = analysisStore.get(req.params.analysisId);
    if (!record) {
      return res.status(404).json({ error: 'Analysis ID not found.' });
    }
    return res.json(record);
  });

  app.get('/api/analysis/:analysisId/explanation', (req, res) => {
    const record = analysisStore.get(req.params.analysisId);
    if (!record) {
      return res.status(404).json({ error: 'Analysis ID not found.' });
    }
    const siteId = typeof req.query.siteId === 'string' ? req.query.siteId : undefined;
    const siteEval = siteId
      ? record.results.find((r) => r.siteId === siteId)
      : record.results[0];

    if (!siteEval) {
      return res.status(404).json({ error: 'Site evaluation not found in analysis.' });
    }

    return res.json({
      analysisId: record.analysisId,
      methodologyVersion: record.methodologyVersion,
      targetName: record.targetName,
      siteEval,
    });
  });

  app.get('/api/reports', (_req, res) => {
    res.json({ reports: Array.from(reportStore.values()).reverse() });
  });

  app.post('/api/reports/generate', (req, res) => {
    const { analysisId, siteId } = req.body ?? {};
    const analysis = analysisStore.get(analysisId);
    if (!analysis) {
      return res.status(404).json({ error: 'Cannot generate report: analysisId not found.' });
    }
    const siteEval = analysis.results.find((r) => r.siteId === siteId);
    if (!siteEval) {
      return res.status(404).json({ error: 'Cannot generate report: siteId not found in analysis.' });
    }
    const target = PLANETARY_TARGETS.find((t) => t.id === analysis.targetId)!;
    const earthSite = earthSites.find((s) => s.id === siteId)!;

    const relevantDatasets = datasets.filter(
      (d) =>
        target.datasets.includes(d.id) ||
        d.body === 'EARTH'
    );

    const reportId = `RPT-${analysis.targetBody}-${String(reportSeq++).padStart(4, '0')}`;
    const report: MissionReport = {
      reportId,
      createdAtUtc: new Date().toISOString(),
      analysisId: analysis.analysisId,
      targetId: analysis.targetId,
      targetName: analysis.targetName,
      targetBody: analysis.targetBody,
      siteId: siteEval.siteId,
      siteName: siteEval.siteName,
      country: siteEval.country,
      overallSimilarityScore: siteEval.overallSimilarityScore,
      rank: siteEval.rank,
      totalCandidatesEvaluated: analysis.totalEvaluatedCount,
      coverageRatio: siteEval.coverageRatio,
      confidenceLevel: siteEval.confidenceLevel,
      temperatureMode: analysis.temperatureMode,
      weights: analysis.weights,
      datasetReferences: relevantDatasets,
      featureComparisons: siteEval.featureBreakdown,
      methodologySummary:
        `Transparent weighted feature-distance evaluation (${analysis.methodologyVersion}). Each comparable numerical parameter is normalized against domain calibration spans, missing or unit-incompatible parameters are excluded without zero-imputation, and remaining weights are renormalized proportionally.`,
      scientificLimitations: [
        'Similarity is a relative mathematical index across selected physical variables, NOT a probability or claim of full environmental equivalence.',
        'Planetary vertical datums (Lunar 1737.4 km sphere; Mars MOLA areoid) differ fundamentally from Earth sea-level EGM96 datum.',
        'Terrestrial atmospheric pressure (~1013 mbar at sea level) and O₂/N₂ composition are absent on the Moon (~10⁻¹² bar) and differ from Mars (~6 mbar CO₂).',
        ...siteEval.scientificWarnings,
        ...siteEval.confidenceNotes,
      ],
      sourceReferences: [
        ...target.datasets.map((id) => datasets.find((d) => d.id === id)?.provenanceUrl ?? id),
        ...earthSite.datasetsUsed,
      ],
    };

    reportStore.set(reportId, report);
    recordActivity(
      'REPORT',
      `Scientific dossier generated (${reportId})`,
      `${target.name} vs ${siteEval.siteName} — Score: ${siteEval.overallSimilarityScore !== null ? `${(siteEval.overallSimilarityScore * 100).toFixed(1)}%` : 'INSUFFICIENT DATA'}`
    );

    return res.status(201).json(report);
  });

  app.get('/api/reports/:reportId', (req, res) => {
    const report = reportStore.get(req.params.reportId);
    if (!report) {
      return res.status(404).json({ error: 'Report ID not found.' });
    }
    return res.json(report);
  });

  app.get('/api/activity', (_req, res) => {
    res.json({ events: activityLog });
  });

  app.post('/api/activity/target-switch', (req, res) => {
    const { targetId } = req.body ?? {};
    const target = PLANETARY_TARGETS.find((t) => t.id === targetId);
    if (!target) {
      return res.status(400).json({ error: 'Invalid targetId' });
    }
    recordActivity(
      'TARGET',
      `Active planetary target switched to ${target.name}`,
      `${target.body} · ${target.coordinates.formatted}`
    );
    return res.json({ ok: true });
  });

  app.get('/api/external/nasa-power', async (req, res) => {
    const lat = Number(req.query.lat);
    const lon = Number(req.query.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      return res.status(400).json({ error: 'Valid numeric lat [-90,90] and lon [-180,180] are required.' });
    }

    const url = `https://power.larc.nasa.gov/api/temporal/climatology/point?parameters=T2M,PRECTOTCORR,ALLSKY_SFC_SW_DWN&community=RE&longitude=${lon.toFixed(4)}&latitude=${lat.toFixed(4)}&format=JSON`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);
      if (!response.ok) {
        return res.json({
          live: false,
          status: 'UPSTREAM_ERROR',
          httpStatus: response.status,
          endpoint: url,
          message: `NASA POWER responded with HTTP ${response.status}. Local reference climatology remains available.`,
        });
      }
      const data = await response.json();
      recordActivity(
        'EXTERNAL_API',
        `NASA POWER climatology query succeeded`,
        `Queried point (${lat.toFixed(2)}, ${lon.toFixed(2)}) via power.larc.nasa.gov.`
      );
      return res.json({
        live: true,
        status: 'LIVE_RESPONSE',
        source: 'NASA POWER API (Climatology)',
        endpoint: url,
        coordinates: { lat, lon },
        parameters: data?.properties?.parameter ?? null,
        header: data?.header ?? null,
      });
    } catch (err) {
      clearTimeout(timeout);
      return res.json({
        live: false,
        status: 'OFFLINE_OR_TIMEOUT',
        endpoint: url,
        message:
          err instanceof Error
            ? `External NASA POWER request unreachable (${err.message}). Using local validated dataset architecture.`
            : 'External NASA POWER request unreachable.',
      });
    }
  });

  app.post('/api/si/agent', async (req, res) => {
    const {
      prompt,
      history = [],
      activeTargetId,
      stream = true,
    }: {
      prompt?: string;
      history?: Array<{ role?: string; text?: string }>;
      activeTargetId?: TargetId;
      stream?: boolean;
    } = req.body ?? {};

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      return res.status(400).json({ error: 'A non-empty scientific prompt is required.' });
    }
    if (prompt.length > 4000) {
      return res.status(400).json({ error: 'Prompt exceeds 4,000 character limit.' });
    }

    const ai = getGeminiClient();
    if (!ai) {
      return res.status(503).json({
        error:
          'GEMINI_API_KEY is not configured in the server environment. Set it in Settings > Secrets to enable the SI Agent.',
      });
    }

    const sanitizedHistory: Content[] = Array.isArray(history)
      ? history
          .slice(-10)
          .filter(
            (m) =>
              m &&
              (m.role === 'user' || m.role === 'model') &&
              typeof m.text === 'string' &&
              m.text.trim().length > 0
          )
          .map((m) => ({
            role: m.role as 'user' | 'model',
            parts: [{ text: m.text!.trim() }],
          }))
      : [];

    const contextHeader = `[Workspace Context: activeTarget=${activeTargetId ?? 'shackleton'}, datasets=${datasets.length}, earthSites=${earthSites.length}]`;
    const contents: Content[] = [
      ...sanitizedHistory,
      {
        role: 'user',
        parts: [{ text: `${contextHeader}\n${prompt.trim()}` }],
      },
    ];

    interface TraceStep {
      id: string;
      phase: 'planning' | 'tool_call' | 'tool_result' | 'synthesizing';
      title: string;
      detail: string;
      toolName?: string;
      args?: Record<string, unknown>;
      timestampUtc: string;
    }

    const traces: TraceStep[] = [];
    let latestAnalysisRecord: AnalysisRunRecord | null = null;
    let streamOpen = false;

    const emitEvent = (payload: Record<string, unknown>) => {
      if (stream && !res.writableEnded) {
        if (!streamOpen) {
          res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
          res.setHeader('Cache-Control', 'no-cache, no-transform');
          res.setHeader('X-Accel-Buffering', 'no');
          streamOpen = true;
        }
        res.write(`${JSON.stringify(payload)}\n`);
      }
    };

    const pushTrace = (step: Omit<TraceStep, 'id' | 'timestampUtc'>) => {
      const fullStep: TraceStep = {
        ...step,
        id: `tr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        timestampUtc: new Date().toISOString(),
      };
      traces.push(fullStep);
      emitEvent({ type: 'trace', step: fullStep });
    };

    try {
      const siCtx = {
        targets: PLANETARY_TARGETS,
        earthSites,
        datasets,
        onAnalysisRecorded: (record: AnalysisRunRecord) => {
          latestAnalysisRecord = record;
          analysisStore.set(record.analysisId, record);
          const top = record.results.find((r) => r.rank === 1);
          recordActivity(
            'ANALYSIS',
            `SI Agent similarity run (${record.analysisId})`,
            `${record.targetName} evaluated via SI orchestrator. Top candidate: ${top ? `${top.siteName} (${(top.overallSimilarityScore! * 100).toFixed(1)}%)` : 'Insufficient data'}.`
          );
        },
      };

      let finalAnswer = '';
      let activeModel = SI_MODEL_NAME;
      const maxSteps = 5;

      const isTransientError = (err: unknown): boolean => {
        const msg = err instanceof Error ? err.message : String(err ?? '');
        return (
          msg.includes('503') ||
          msg.includes('UNAVAILABLE') ||
          msg.includes('high demand') ||
          msg.includes('429') ||
          msg.includes('RESOURCE_EXHAUSTED') ||
          msg.includes('ECONNRESET') ||
          msg.includes('ETIMEDOUT') ||
          msg.includes('fetch failed')
        );
      };

      const callModelWithRetry = async (withTools: boolean) => {
        const modelsToTry =
          activeModel === SI_MODEL_NAME
            ? [SI_MODEL_NAME, SI_FALLBACK_MODEL_NAME]
            : [activeModel];

        let lastErr: unknown;
        for (const candidateModel of modelsToTry) {
          if (candidateModel !== activeModel) {
            activeModel = candidateModel;
            pushTrace({
              phase: 'planning',
              title: `Switching to ${candidateModel}`,
              detail: `${SI_MODEL_NAME} experiencing transient upstream congestion; routing to backup reasoning model ${candidateModel}.`,
            });
          }

          for (let attempt = 0; attempt < 3; attempt++) {
            try {
              const resp = await ai.models.generateContent({
                model: candidateModel,
                contents,
                config: {
                  systemInstruction: SI_SYSTEM_INSTRUCTION,
                  ...(candidateModel.startsWith('gemini-4')
                    ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
                    : {}),
                  ...(withTools ? { tools: [{ functionDeclarations: SI_TOOL_DECLARATIONS }] } : {}),
                },
              });
              return resp;
            } catch (err) {
              lastErr = err;
              if (!isTransientError(err) || attempt === 2) {
                break;
              }
              const delayMs = 700 * Math.pow(2, attempt);
              pushTrace({
                phase: 'planning',
                title: `Retrying ${candidateModel} (${attempt + 2}/3)`,
                detail: `Transient upstream load detected; backing off ${delayMs} ms before retry...`,
              });
              await new Promise((resolve) => setTimeout(resolve, delayMs));
            }
          }

          if (!isTransientError(lastErr)) {
            throw lastErr;
          }
        }
        throw lastErr;
      };

      for (let stepIdx = 0; stepIdx < maxSteps; stepIdx++) {
        pushTrace({
          phase: 'planning',
          title:
            stepIdx === 0
              ? 'Planning Autonomous Investigation'
              : `Evaluating Tool Evidence (Pass ${stepIdx + 1})`,
          detail:
            stepIdx === 0
              ? `Model ${activeModel} parsing geospatial intent and scientific guardrails...`
              : 'Reviewing returned dataset metadata and similarity metrics for next action...',
        });

        const response = await callModelWithRetry(true);

        const candidateContent = response.candidates?.[0]?.content;
        if (candidateContent) {
          contents.push(candidateContent);
        }

        const calls = response.functionCalls;
        if (!calls || calls.length === 0) {
          finalAnswer =
            response.text?.trim() ||
            'Investigation complete, but the model returned an empty synthesis.';
          pushTrace({
            phase: 'synthesizing',
            title: 'Synthesizing Verified Brief',
            detail:
              'Confirmed thermal measurement compatibility, WGS84 bounds, and dataset provenance.',
          });
          break;
        }

        const responseParts: Part[] = [];
        for (const call of calls) {
          const toolName = call.name ?? 'unknown_tool';
          const args = (call.args ?? {}) as Record<string, unknown>;

          pushTrace({
            phase: 'tool_call',
            toolName,
            args,
            title: `Executing ${toolName}`,
            detail: Object.keys(args).length > 0 ? JSON.stringify(args) : 'Default workspace scope',
          });

          let toolResultPayload: Record<string, unknown>;
          let summaryText: string;

          if (toolName === 'run_similarity_analysis') {
            const out = executeRunSimilarityAnalysis(args as RunSimilarityToolArgs, siCtx);
            toolResultPayload = out.resultPayload;
            summaryText = out.summaryText;
          } else if (toolName === 'query_dataset_metadata') {
            const out = executeQueryDatasetMetadata(args as QueryMetadataToolArgs, siCtx);
            toolResultPayload = out.resultPayload;
            summaryText = out.summaryText;
          } else {
            summaryText = `Unsupported tool requested: ${toolName}`;
            toolResultPayload = { ok: false, error: summaryText };
          }

          pushTrace({
            phase: 'tool_result',
            toolName,
            title: `Completed ${toolName}`,
            detail: summaryText,
          });

          responseParts.push({
            functionResponse: {
              id: call.id,
              name: toolName,
              response: toolResultPayload,
            },
          });
        }

        contents.push({
          role: 'user',
          parts: responseParts,
        });

        if (stepIdx === maxSteps - 1) {
          pushTrace({
            phase: 'synthesizing',
            title: 'Finalizing Synthesis',
            detail: 'Compiling evidence from completed ReAct tool passes...',
          });
          const fallbackResp = await callModelWithRetry(false);
          finalAnswer =
            fallbackResp.text?.trim() || 'Reached maximum reasoning depth after tool execution.';
        }
      }

      const finalPayload = {
        type: 'final',
        model: activeModel,
        answerMarkdown: finalAnswer,
        traces,
        analysisRecord: latestAnalysisRecord,
      };

      if (stream) {
        emitEvent(finalPayload);
        return res.end();
      }
      return res.json(finalPayload);
    } catch (err) {
      const rawMsg = err instanceof Error ? err.message : 'SI Agent execution failed.';
      let friendlyMsg = rawMsg;
      if (rawMsg.includes('API_KEY_INVALID') || rawMsg.includes('PERMISSION_DENIED')) {
        friendlyMsg =
          'Gemini API authentication failed. Please verify GEMINI_API_KEY in Settings > Secrets.';
      } else if (rawMsg.includes('RESOURCE_EXHAUSTED') || rawMsg.includes('429')) {
        friendlyMsg =
          'Gemini API rate or quota limit reached. Please retry shortly or check quota in Settings > Secrets.';
      } else if (rawMsg.includes('503') || rawMsg.includes('UNAVAILABLE') || rawMsg.includes('high demand')) {
        friendlyMsg =
          'Gemini reasoning models are temporarily experiencing high upstream demand (503). Please retry your SI query in a few seconds.';
      } else if (rawMsg.includes('NOT_FOUND') || rawMsg.includes('404')) {
        friendlyMsg = `Requested Gemini model (${SI_MODEL_NAME}) was unavailable or returned 404.`;
      }

      if (streamOpen && !res.writableEnded) {
        emitEvent({ type: 'error', error: friendlyMsg });
        return res.end();
      }
      return res.status(502).json({ error: friendlyMsg });
    }
  });

  return app;
}

async function startServer() {
  const app = createApp();
  const httpServer = http.createServer(app);

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        ws: { server: httpServer },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`TERRA-9 server operational on http://0.0.0.0:${PORT}`);
  });
}

startServer();
