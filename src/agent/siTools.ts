import { FunctionDeclaration, Type } from '@google/genai';
import { PLANETARY_SUMMARIES, type PlanetarySummary } from '../../planetaryMetadata';
import {
  DEFAULT_FEATURE_WEIGHTS,
  METHODOLOGY_VERSION,
  evaluateEarthAnalogs,
} from '../engine/similarity';
import type {
  AnalysisRunRecord,
  DatasetRegistryEntry,
  EarthSite,
  FeatureWeights,
  PlanetaryTarget,
  TargetId,
  TemperatureComparisonMode,
} from '../engine/types';

export const SI_MODEL_NAME = 'gemini-4-hydrogen';
export const SI_FALLBACK_MODEL_NAME = 'gemini-3.1-flash-lite';

export const SI_SYSTEM_INSTRUCTION = `You are TERRA-9 SI (Super Intelligence), an autonomous planetary science and geospatial Earth-analog research agent operating inside the TERRA-9 Mission Control platform developed by 9X MOTIONS (NASA Space Apps Challenge 2026).

SCIENTIFIC GUARDRAILS (STRICTLY ENFORCED):
1. THERMAL MEASUREMENT COMPATIBILITY:
   - Never equate or directly compare Earth 2m atmospheric air temperature (NASA POWER T2M, unit °C, measurementType AIR_TEMP_2M_C) with planetary surface radiometric skin temperature (LRO Diviner, Mars Odyssey THEMIS, MODIS MOD11A2 LST, unit K, measurementType SURFACE_RADIOMETRIC_TEMP_K).
   - If NASA_POWER_AIR_2M is requested or inspected, explicitly state that it is INCOMPATIBLE_MEASUREMENT_TYPE and excluded from weighted scoring.
   - Distinguish absolute mean surface skin temperature (K) from thermal anomaly deltas (thermalAnomalyMeanC in °C, e.g. in tmax_tmin_anom.xyz).
2. COORDINATE & DATUM VALIDATION:
   - Only cite verified WGS84 coordinates (latitude in [-90, 90], longitude in [-180, 180]) returned by your tools. Never invent coordinates.
   - Always disclose vertical datum differences: Lunar 1737.4 km reference sphere (LOLA) and Mars MOLA equipotential areoid vs Earth WGS84/EGM96 sea-level datum.
3. MANDATORY SOURCE PROVENANCE & ZERO IMPUTATION:
   - Every numerical metric, ranking, or anomaly value must cite its exact dataset/instrument source (e.g., LRO LOLA LDEM_80S_20M, LRO Diviner, MGS MOLA MEGDR, Mars Odyssey THEMIS, MODIS MOD11A2, NASA POWER, Site04_final_adj_5mpp_surf.tiff, tmax_tmin_anom.xyz, jezero_elevation_mosaic.tiff, or user-ingested CSV datasets).
   - Never fabricate or zero-fill missing measurements. Explicitly disclose DATA UNAVAILABLE channels.
   - Frame similarity scores strictly as relative weighted feature-distance indices (${METHODOLOGY_VERSION}), never as probabilities or claims of planetary environmental equivalence.
4. INTERACTIVE CITATION FORMATTING:
   - When citing an Earth analog site in your Markdown response, format it as a clickable TERRA-9 citation link when possible, e.g. [Atacama Desert (24.08°S, 69.92°W)](terra9://site/atacama), or include explicit coordinates in brackets like (-24.08, -69.92) so the operator can pan and zoom the geospatial map directly.

WORKFLOW:
- Use query_dataset_metadata to inspect .xyz grids, GeoTIFF planetary summaries, and CSV/JSON dataset provenance before making claims about dataset coverage or anomalies.
- Use run_similarity_analysis whenever the user asks to rank, score, compare, or re-weight Earth analogs against Moon (shackleton) or Mars (jezero).
- Keep your final synthesis concise, structured with clear Markdown headings/tables, empirically grounded, and strictly faithful to tool outputs.`;

export const SI_TOOL_DECLARATIONS: FunctionDeclaration[] = [
  {
    name: 'run_similarity_analysis',
    description:
      'Computes deterministic normalized weighted feature-distance similarity metrics between a planetary target (shackleton Moon or jezero Mars) and all registered Earth analog candidate sites.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        targetId: {
          type: Type.STRING,
          description:
            'Planetary target identifier: "shackleton" (Moon South Pole) or "jezero" (Mars paleolake crater).',
        },
        temperatureMode: {
          type: Type.STRING,
          description:
            'Thermal channel mode: "MODIS_SURFACE_LST" (compatible radiative skin temp in K) or "NASA_POWER_AIR_2M" (2m air temp in °C, flagged incompatible by scientific guardrail). Defaults to "MODIS_SURFACE_LST".',
        },
        weights: {
          type: Type.OBJECT,
          description:
            'Optional non-negative feature weights (automatically renormalized over comparable features).',
          properties: {
            elevation: { type: Type.NUMBER, description: 'Weight for elevation datum difference.' },
            slope: { type: Type.NUMBER, description: 'Weight for terrain slope gradient.' },
            surfaceTemp: { type: Type.NUMBER, description: 'Weight for surface radiometric temperature.' },
            precipitation: { type: Type.NUMBER, description: 'Weight for annual precipitation aridity.' },
            solarIrradiance: { type: Type.NUMBER, description: 'Weight for mean solar irradiance.' },
          },
        },
        limit: {
          type: Type.INTEGER,
          description: 'Optional maximum number of ranked sites to include in summary (default 8).',
        },
      },
      required: ['targetId'],
    },
  },
  {
    name: 'query_dataset_metadata',
    description:
      'Searches planetary and terrestrial metadata grids (.xyz thermal/elevation anomaly files, GeoTIFF DEM summaries) and registered/ingested CSV or JSON datasets and Earth candidate site records.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: {
          type: Type.STRING,
          description:
            'Optional search keyword such as filename ("tmax_tmin_anom.xyz", "Site04_final_adj_5mpp_surf.tiff", "jezero_elevation_mosaic.tiff"), dataset ID, site name, or instrument.',
        },
        body: {
          type: Type.STRING,
          description: 'Optional planetary body filter: "MOON", "MARS", or "EARTH".',
        },
        format: {
          type: Type.STRING,
          description: 'Optional format filter such as "XYZ", "GeoTIFF", "CSV", "JSON", or "PDS4".',
        },
        includeSiteRecords: {
          type: Type.BOOLEAN,
          description:
            'If true, also returns matching Earth candidate site records with verified WGS84 coordinates and telemetry parameters.',
        },
      },
    },
  },
];

export interface SIStateContext {
  targets: PlanetaryTarget[];
  earthSites: EarthSite[];
  datasets: DatasetRegistryEntry[];
  planetarySummaries?: PlanetarySummary[];
  onAnalysisRecorded?: (record: AnalysisRunRecord) => void;
}

export interface RunSimilarityToolArgs {
  targetId?: string;
  temperatureMode?: string;
  weights?: Partial<FeatureWeights>;
  limit?: number;
}

export interface QueryMetadataToolArgs {
  query?: string;
  body?: string;
  format?: string;
  includeSiteRecords?: boolean;
}

export function validateWgs84Coordinates(lat: number, lon: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    lat >= -90 &&
    lat <= 90 &&
    lon >= -180 &&
    lon <= 180
  );
}

export function executeRunSimilarityAnalysis(
  args: RunSimilarityToolArgs,
  ctx: SIStateContext
): {
  ok: boolean;
  error?: string;
  record?: AnalysisRunRecord;
  summaryText: string;
  resultPayload: Record<string, unknown>;
} {
  const rawTarget = String(args.targetId ?? '').trim().toLowerCase();
  const resolvedTargetId: TargetId | null =
    rawTarget === 'shackleton' || rawTarget === 'moon'
      ? 'shackleton'
      : rawTarget === 'jezero' || rawTarget === 'mars'
      ? 'jezero'
      : null;

  const target = resolvedTargetId
    ? ctx.targets.find((t) => t.id === resolvedTargetId)
    : undefined;

  if (!target) {
    const error = `Invalid targetId "${args.targetId ?? ''}". Valid targets are "shackleton" (MOON) and "jezero" (MARS).`;
    return {
      ok: false,
      error,
      summaryText: error,
      resultPayload: { ok: false, error },
    };
  }

  const temperatureMode: TemperatureComparisonMode =
    args.temperatureMode === 'NASA_POWER_AIR_2M'
      ? 'NASA_POWER_AIR_2M'
      : 'MODIS_SURFACE_LST';

  const w = args.weights ?? {};
  const mergedWeights: FeatureWeights = {
    elevation: Number.isFinite(w.elevation)
      ? Math.max(0, Number(w.elevation))
      : DEFAULT_FEATURE_WEIGHTS.elevation,
    slope: Number.isFinite(w.slope)
      ? Math.max(0, Number(w.slope))
      : DEFAULT_FEATURE_WEIGHTS.slope,
    surfaceTemp: Number.isFinite(w.surfaceTemp)
      ? Math.max(0, Number(w.surfaceTemp))
      : DEFAULT_FEATURE_WEIGHTS.surfaceTemp,
    precipitation: Number.isFinite(w.precipitation)
      ? Math.max(0, Number(w.precipitation))
      : DEFAULT_FEATURE_WEIGHTS.precipitation,
    solarIrradiance: Number.isFinite(w.solarIrradiance)
      ? Math.max(0, Number(w.solarIrradiance))
      : DEFAULT_FEATURE_WEIGHTS.solarIrradiance,
  };

  const weightSum = Object.values(mergedWeights).reduce((acc, val) => acc + val, 0);
  if (weightSum <= 0) {
    const error = 'At least one feature weight must be strictly greater than zero.';
    return {
      ok: false,
      error,
      summaryText: error,
      resultPayload: { ok: false, error },
    };
  }

  const results = evaluateEarthAnalogs(
    target,
    ctx.earthSites,
    mergedWeights,
    temperatureMode
  );

  const analysisId = `ANL-SI-${target.body}-${Date.now().toString(36).toUpperCase()}`;
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

  ctx.onAnalysisRecorded?.(record);

  const maxItems =
    typeof args.limit === 'number' && Number.isFinite(args.limit) && args.limit > 0
      ? Math.min(20, Math.floor(args.limit))
      : results.length;

  const sliced = results.slice(0, maxItems).map((r) => ({
    rank: r.rank,
    siteId: r.siteId,
    siteName: r.siteName,
    country: r.country,
    coordinates: r.coordinates,
    coordinatesValidWgs84: validateWgs84Coordinates(r.coordinates.lat, r.coordinates.lon),
    overallSimilarityScore: r.overallSimilarityScore,
    overallSimilarityPct:
      r.overallSimilarityScore !== null
        ? Number((r.overallSimilarityScore * 100).toFixed(2))
        : null,
    comparableFeatureCount: r.comparableFeatureCount,
    totalConfiguredFeatures: r.totalConfiguredFeatures,
    confidenceLevel: r.confidenceLevel,
    scientificWarnings: r.scientificWarnings,
    featureBreakdown: r.featureBreakdown.map((fb) => ({
      feature: fb.feature,
      label: fb.label,
      planetaryValue: fb.planetaryValue,
      planetaryUnit: fb.planetaryUnit,
      planetarySource: fb.planetarySource,
      earthValue: fb.earthValue,
      earthUnit: fb.earthUnit,
      earthSource: fb.earthSource,
      compatibilityStatus: fb.compatibilityStatus,
      effectiveWeight: fb.effectiveWeight,
      similarityContribution: fb.similarityContribution,
      includedInScore: fb.includedInScore,
    })),
    rankingExplanation: r.rankingExplanation,
  }));

  const top = results.find((r) => r.rank === 1);
  const thermalWarning =
    temperatureMode === 'NASA_POWER_AIR_2M'
      ? ' · Thermal guardrail triggered: NASA_POWER_AIR_2M excluded as incompatible'
      : '';
  const summaryText = top
    ? `${target.name} (${target.body}) ranked ${record.eligibleRankedCount}/${record.totalEvaluatedCount} sites · #1 ${top.siteName} (${(top.overallSimilarityScore! * 100).toFixed(1)}%)${thermalWarning}`
    : `${target.name} evaluated ${record.totalEvaluatedCount} sites with insufficient comparable channels${thermalWarning}`;

  return {
    ok: true,
    record,
    summaryText,
    resultPayload: {
      ok: true,
      analysisId: record.analysisId,
      methodologyVersion: METHODOLOGY_VERSION,
      target: {
        id: target.id,
        name: target.name,
        body: target.body,
        coordinates: target.coordinates,
        datasets: target.datasets,
        unavailableBands: target.unavailableBands,
      },
      temperatureMode,
      weightsUsed: mergedWeights,
      eligibleRankedCount: record.eligibleRankedCount,
      totalEvaluatedCount: record.totalEvaluatedCount,
      results: sliced,
    },
  };
}

export function executeQueryDatasetMetadata(
  args: QueryMetadataToolArgs,
  ctx: SIStateContext
): {
  ok: boolean;
  summaryText: string;
  resultPayload: Record<string, unknown>;
} {
  const summaries = ctx.planetarySummaries ?? PLANETARY_SUMMARIES;
  const queryNorm = (args.query ?? '').trim().toLowerCase();
  const bodyFilter = (args.body ?? '').trim().toUpperCase();
  const formatFilter = (args.format ?? '').trim().toLowerCase();

  const matchingGridSummaries = summaries.filter((item) => {
    if (bodyFilter && item.body !== bodyFilter) return false;
    if (formatFilter) {
      const ext = item.sourceFileName.split('.').pop()?.toLowerCase() ?? '';
      const matchesFormat =
        (formatFilter === 'xyz' && ext === 'xyz') ||
        (formatFilter.includes('tiff') && (ext === 'tiff' || ext === 'tif')) ||
        item.sourceFileName.toLowerCase().includes(formatFilter);
      if (!matchesFormat) return false;
    }
    if (!queryNorm) return true;
    return (
      item.datasetId.toLowerCase().includes(queryNorm) ||
      item.sourceFileName.toLowerCase().includes(queryNorm) ||
      item.body.toLowerCase().includes(queryNorm) ||
      (queryNorm.includes('anom') && item.sourceFileName.toLowerCase().includes('anom')) ||
      (queryNorm.includes('xyz') && item.sourceFileName.toLowerCase().endsWith('.xyz')) ||
      (queryNorm.includes('elev') && item.sourceFileName.toLowerCase().includes('elev'))
    );
  });

  const matchingDatasets = ctx.datasets.filter((ds) => {
    if (bodyFilter && ds.body !== bodyFilter) return false;
    if (formatFilter && !ds.fileFormat.toLowerCase().includes(formatFilter)) {
      return false;
    }
    if (!queryNorm) return true;
    const haystack = [
      ds.id,
      ds.name,
      ds.body,
      ds.sourceAgency,
      ds.instrument,
      ds.fileFormat,
      ds.measurementUnits,
      ds.notes,
      ds.provenanceUrl,
    ]
      .join(' ')
      .toLowerCase();
    return haystack.includes(queryNorm);
  });

  const matchingSites =
    args.includeSiteRecords === false
      ? []
      : ctx.earthSites
          .filter((site) => {
            if (bodyFilter && bodyFilter !== 'EARTH') return false;
            if (!queryNorm) return true;
            const haystack = [
              site.id,
              site.name,
              site.subregion,
              site.country,
              site.terrainCategory,
              site.geologySummary,
              ...site.datasetsUsed,
            ]
              .join(' ')
              .toLowerCase();
            return haystack.includes(queryNorm);
          })
          .map((site) => ({
            id: site.id,
            name: site.name,
            subregion: site.subregion,
            country: site.country,
            coordinates: site.coordinates,
            coordinatesValidWgs84: validateWgs84Coordinates(
              site.coordinates.lat,
              site.coordinates.lon
            ),
            terrainCategory: site.terrainCategory,
            dataCompletenessPct: site.dataCompletenessPct,
            datasetsUsed: site.datasetsUsed,
            parameters: {
              elevation: site.parameters.elevation,
              slope: site.parameters.slope,
              surfaceTempK: site.parameters.surfaceTemp,
              airTemp2mC: site.parameters.airTemp2m,
              precipitationMmYr: site.parameters.precipitation,
              solarIrradianceWm2: site.parameters.solarIrradiance,
            },
          }));

  const summaryText = `Matched ${matchingGridSummaries.length} raster/XYZ grid summary(ies), ${matchingDatasets.length} registry dataset(s), and ${matchingSites.length} Earth site record(s).`;

  return {
    ok: true,
    summaryText,
    resultPayload: {
      ok: true,
      filtersApplied: {
        query: args.query ?? null,
        body: bodyFilter || null,
        format: args.format ?? null,
      },
      gridSummaries: matchingGridSummaries,
      registryDatasets: matchingDatasets,
      earthSites: matchingSites,
      totalRegistryDatasets: ctx.datasets.length,
      totalGridSummaries: summaries.length,
    },
  };
}
