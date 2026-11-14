import type {
  CompatibilityStatus,
  ConfidenceLevel,
  EarthSite,
  FeatureComparisonResult,
  FeatureKey,
  FeatureWeights,
  PlanetaryTarget,
  ScientificMeasurement,
  SiteSimilarityEvaluation,
  TemperatureComparisonMode,
} from './types';

export const METHODOLOGY_VERSION = 'TERRA9-WFD-1.2';

export const DEFAULT_FEATURE_WEIGHTS: FeatureWeights = {
  elevation: 0.2,
  slope: 0.2,
  surfaceTemp: 0.25,
  precipitation: 0.2,
  solarIrradiance: 0.15,
};

/**
 * Calibration bounds used to normalize absolute feature differences onto [0, 1].
 * Any difference >= maxSpan saturates at normalized distance 1.0 (similarity 0.0).
 */
export const FEATURE_SCALES: Record<
  FeatureKey,
  { label: string; maxSpan: number; unit: string }
> = {
  elevation: { label: 'Elevation (Datum / ASL)', maxSpan: 8500, unit: 'm' },
  slope: { label: 'Terrain Slope Gradient', maxSpan: 35, unit: 'deg' },
  surfaceTemp: { label: 'Surface Radiometric Temp', maxSpan: 220, unit: 'K' },
  precipitation: { label: 'Annual Precipitation', maxSpan: 1500, unit: 'mm/yr' },
  solarIrradiance: { label: 'Mean Solar Irradiance', maxSpan: 1200, unit: 'W/m²' },
};

const FEATURE_ORDER: FeatureKey[] = [
  'elevation',
  'slope',
  'surfaceTemp',
  'precipitation',
  'solarIrradiance',
];

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function roundTo(n: number, decimals = 4): number {
  const factor = 10 ** decimals;
  return Math.round(n * factor) / factor;
}

export function checkFeatureCompatibility(
  feature: FeatureKey,
  target: PlanetaryTarget,
  targetMeas: ScientificMeasurement,
  earthMeas: ScientificMeasurement
): { status: CompatibilityStatus; note: string } {
  if (
    !targetMeas.isAvailable ||
    targetMeas.value === null ||
    targetMeas.dataKind === 'NOT_APPLICABLE' ||
    targetMeas.dataKind === 'UNAVAILABLE'
  ) {
    return {
      status: 'DATA_UNAVAILABLE',
      note: `Planetary target (${target.name}) lacks an applicable measurement for ${FEATURE_SCALES[feature].label}: ${targetMeas.provenanceNote}`,
    };
  }

  if (
    !earthMeas.isAvailable ||
    earthMeas.value === null ||
    earthMeas.dataKind === 'UNAVAILABLE'
  ) {
    return {
      status: 'DATA_UNAVAILABLE',
      note: `Terrestrial site measurement unavailable for ${FEATURE_SCALES[feature].label}: ${earthMeas.provenanceNote}`,
    };
  }

  if (feature === 'surfaceTemp') {
    if (
      targetMeas.measurementType === 'SURFACE_RADIOMETRIC_TEMP_K' &&
      earthMeas.measurementType === 'AIR_TEMP_2M_C'
    ) {
      return {
        status: 'INCOMPATIBLE_MEASUREMENT_TYPE',
        note: 'INCOMPATIBLE: Earth 2m atmospheric air temperature (°C) cannot be directly compared to planetary surface radiometric skin temperature (K). Excluded from similarity calculation; select MODIS MOD11A2 Land Surface Temperature (LST) for radiative skin comparison.',
      };
    }

    if (
      targetMeas.measurementType === 'SURFACE_RADIOMETRIC_TEMP_K' &&
      earthMeas.measurementType === 'SURFACE_RADIOMETRIC_TEMP_K'
    ) {
      return {
        status: 'COMPATIBLE_WITH_CAVEAT',
        note: `Compatible radiative skin temperature (K). Caveat: ${target.body === 'MOON' ? 'Lunar regolith experiences vacuum radiative extremes (PSR ~40K vs sunlit rim ~260K)' : 'Martian thin CO₂ atmosphere (~6 mbar) yields higher diurnal thermal amplitude than Earth LST'}.`,
      };
    }
  }

  if (feature === 'elevation') {
    return {
      status: 'COMPATIBLE_WITH_CAVEAT',
      note: `Vertical datum differs (${target.body === 'MOON' ? 'Lunar radius 1737.4 km reference sphere' : 'Mars MOLA equipotential areoid'} vs Earth WGS84/EGM96 ASL). Compared as relative relief/altitude magnitude.`,
    };
  }

  if (feature === 'precipitation') {
    if (target.body === 'MARS') {
      return {
        status: 'COMPATIBLE_WITH_CAVEAT',
        note: 'Present-day Martian liquid precipitation is 0 mm/yr (hyper-arid). Earth precipitation measures modern hydrological aridity only, not Jezero Noachian paleoclimate.',
      };
    }
  }

  if (feature === 'solarIrradiance') {
    return {
      status: 'COMPATIBLE_WITH_CAVEAT',
      note: `Compared in W/m². Caveat: ${target.body === 'MOON' ? 'Lunar South Pole receives low-angle grazing incidence (~0–1361 W/m² locally)' : 'Mars receives ~43% of Earth top-of-atmosphere solar flux (~590 W/m² mean) attenuated by dust opacity'}.`,
    };
  }

  return {
    status: 'COMPATIBLE',
    note: 'Direct unit-verified physical parameter comparison.',
  };
}

export function determineConfidence(
  comparableCount: number,
  totalConfigured: number
): { level: ConfidenceLevel; notes: string[] } {
  const ratio = totalConfigured > 0 ? comparableCount / totalConfigured : 0;
  const notes: string[] = [];

  if (comparableCount < 2 || ratio < 0.4) {
    notes.push(
      `Insufficient comparable features (${comparableCount}/${totalConfigured}). Minimum 2 valid comparable parameters required to compute a relative similarity index.`
    );
    return { level: 'INSUFFICIENT', notes };
  }

  if (ratio < 0.6) {
    notes.push(
      `Low data coverage (${comparableCount}/${totalConfigured} features). Weights were renormalized over available features only; missing channels increase ranking uncertainty.`
    );
    return { level: 'LOW', notes };
  }

  if (ratio < 0.99) {
    notes.push(
      `Moderate coverage (${comparableCount}/${totalConfigured} features). Excluded or unavailable features are disclosed and omitted without zero-imputation.`
    );
    return { level: 'MODERATE', notes };
  }

  notes.push(
    `Full feature coverage (${comparableCount}/${totalConfigured} configured features evaluated).`
  );
  return { level: 'HIGH', notes };
}

export function evaluateSingleSite(
  target: PlanetaryTarget,
  site: EarthSite,
  weights: FeatureWeights = DEFAULT_FEATURE_WEIGHTS,
  temperatureMode: TemperatureComparisonMode = 'MODIS_SURFACE_LST'
): SiteSimilarityEvaluation {
  const activeFeatures = FEATURE_ORDER.filter((f) => (weights[f] ?? 0) > 0);
  const totalConfiguredFeatures = activeFeatures.length;

  const rawComparisons: Array<{
    feature: FeatureKey;
    targetMeas: ScientificMeasurement;
    earthMeas: ScientificMeasurement;
    status: CompatibilityStatus;
    note: string;
    configuredWeight: number;
    included: boolean;
  }> = [];

  const scientificWarningsSet = new Set<string>();

  for (const feature of FEATURE_ORDER) {
    const configuredWeight = Math.max(0, weights[feature] ?? 0);
    const targetMeas = target.parameters[feature];
    const earthMeas =
      feature === 'surfaceTemp'
        ? temperatureMode === 'MODIS_SURFACE_LST'
          ? site.parameters.surfaceTemp
          : site.parameters.airTemp2m
        : site.parameters[feature];

    const compat = checkFeatureCompatibility(feature, target, targetMeas, earthMeas);
    const isComparable =
      configuredWeight > 0 &&
      (compat.status === 'COMPATIBLE' || compat.status === 'COMPATIBLE_WITH_CAVEAT');

    if (compat.status === 'INCOMPATIBLE_MEASUREMENT_TYPE') {
      scientificWarningsSet.add(compat.note);
    } else if (compat.status === 'DATA_UNAVAILABLE' && configuredWeight > 0) {
      scientificWarningsSet.add(compat.note);
    }

    rawComparisons.push({
      feature,
      targetMeas,
      earthMeas,
      status: compat.status,
      note: compat.note,
      configuredWeight,
      included: isComparable,
    });
  }

  const validWeightSum = rawComparisons.reduce(
    (sum, item) => (item.included ? sum + item.configuredWeight : sum),
    0
  );

  const comparableFeatureCount = rawComparisons.filter((item) => item.included).length;
  const coverageRatio =
    totalConfiguredFeatures > 0
      ? roundTo(comparableFeatureCount / totalConfiguredFeatures, 4)
      : 0;

  let weightedScoreSum = 0;

  const featureBreakdown: FeatureComparisonResult[] = rawComparisons.map((item) => {
    const scale = FEATURE_SCALES[item.feature];
    const pVal = item.targetMeas.isAvailable ? item.targetMeas.value : null;
    const eVal = item.earthMeas.isAvailable ? item.earthMeas.value : null;

    let absoluteDifference: number | null = null;
    let normalizedDistance: number | null = null;
    let similarityContribution: number | null = null;
    let effectiveWeight = 0;
    let weightedContribution: number | null = null;

    if (item.included && pVal !== null && eVal !== null && validWeightSum > 0) {
      effectiveWeight = roundTo(item.configuredWeight / validWeightSum, 4);
      absoluteDifference = roundTo(Math.abs(pVal - eVal), 2);
      normalizedDistance = roundTo(clamp01(absoluteDifference / scale.maxSpan), 4);
      similarityContribution = roundTo(1 - normalizedDistance, 4);
      weightedContribution = roundTo(effectiveWeight * similarityContribution, 4);
      weightedScoreSum += effectiveWeight * similarityContribution;
    }

    return {
      feature: item.feature,
      label: scale.label,
      planetaryValue: pVal,
      planetaryUnit: item.targetMeas.unit,
      planetarySource: item.targetMeas.source,
      planetaryMeasurementType: item.targetMeas.measurementType,
      earthValue: eVal,
      earthUnit: item.earthMeas.unit,
      earthSource: item.earthMeas.source,
      earthMeasurementType: item.earthMeas.measurementType,
      absoluteDifference,
      differenceUnit:
        item.status === 'INCOMPATIBLE_MEASUREMENT_TYPE' ? 'N/A (Incompatible Units)' : scale.unit,
      compatibilityStatus: item.status,
      compatibilityNote: item.note,
      configuredWeight: roundTo(item.configuredWeight, 4),
      effectiveWeight,
      normalizedDistance,
      similarityContribution,
      weightedContribution,
      includedInScore: item.included,
    };
  });

  const confidence = determineConfidence(comparableFeatureCount, totalConfiguredFeatures);
  const overallSimilarityScore =
    confidence.level === 'INSUFFICIENT' ? null : roundTo(clamp01(weightedScoreSum), 4);

  const strongestFeature = featureBreakdown
    .filter((f) => f.includedInScore && f.similarityContribution !== null)
    .sort((a, b) => (b.similarityContribution ?? 0) - (a.similarityContribution ?? 0))[0];

  const weakestFeature = featureBreakdown
    .filter((f) => f.includedInScore && f.similarityContribution !== null)
    .sort((a, b) => (a.similarityContribution ?? 0) - (b.similarityContribution ?? 0))[0];

  let rankingExplanation = '';
  if (overallSimilarityScore === null) {
    rankingExplanation = `Not ranked against ${target.name}: only ${comparableFeatureCount} comparable feature(s) available under current constraints.`;
  } else {
    const scorePct = (overallSimilarityScore * 100).toFixed(1);
    const bestText = strongestFeature
      ? `strongest alignment in ${strongestFeature.label} (${((strongestFeature.similarityContribution ?? 0) * 100).toFixed(1)}%)`
      : '';
    const weakText =
      weakestFeature && weakestFeature.feature !== strongestFeature?.feature
        ? ` and widest divergence in ${weakestFeature.label} (${((weakestFeature.similarityContribution ?? 0) * 100).toFixed(1)}%)`
        : '';
    rankingExplanation = `Relative similarity index ${scorePct}% (${overallSimilarityScore.toFixed(3)}) across ${comparableFeatureCount}/${totalConfiguredFeatures} valid parameters, driven by ${bestText}${weakText}. Relative analytical index only; does not imply planetary environmental equivalence.`;
  }

  return {
    siteId: site.id,
    siteName: site.name,
    country: site.country,
    coordinates: site.coordinates,
    terrainCategory: site.terrainCategory,
    rank: null,
    overallSimilarityScore,
    comparableFeatureCount,
    totalConfiguredFeatures,
    coverageRatio,
    confidenceLevel: confidence.level,
    confidenceNotes: confidence.notes,
    scientificWarnings: Array.from(scientificWarningsSet),
    featureBreakdown,
    rankingExplanation,
  };
}

export function evaluateEarthAnalogs(
  target: PlanetaryTarget,
  sites: EarthSite[],
  weights: FeatureWeights = DEFAULT_FEATURE_WEIGHTS,
  temperatureMode: TemperatureComparisonMode = 'MODIS_SURFACE_LST'
): SiteSimilarityEvaluation[] {
  const evaluations = sites.map((site) =>
    evaluateSingleSite(target, site, weights, temperatureMode)
  );

  const ranked = evaluations
    .filter((e) => e.overallSimilarityScore !== null)
    .sort((a, b) => {
      const scoreDiff = (b.overallSimilarityScore ?? 0) - (a.overallSimilarityScore ?? 0);
      if (Math.abs(scoreDiff) > 1e-6) return scoreDiff;
      return b.coverageRatio - a.coverageRatio;
    });

  ranked.forEach((item, index) => {
    item.rank = index + 1;
  });

  const unranked = evaluations.filter((e) => e.overallSimilarityScore === null);
  return [...ranked, ...unranked];
}

export interface ParsedCsvDatasetResult {
  valid: boolean;
  errors: string[];
  rows: Array<{
    siteName: string;
    country: string;
    lat: number;
    lon: number;
    elevationM: number | null;
    slopeDeg: number | null;
    surfaceTempK: number | null;
    precipitationMmYr: number | null;
    solarIrradianceWm2: number | null;
  }>;
}

/**
 * Parses and validates a local CSV dataset for terrestrial candidate ingestion.
 * Missing numeric cells remain `null` (never coerced to 0).
 */
export function parseLocalSiteCsv(csvText: string): ParsedCsvDatasetResult {
  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('#'));

  if (lines.length < 2) {
    return {
      valid: false,
      errors: ['CSV must contain a header row and at least one data row.'],
      rows: [],
    };
  }

  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
  const required = ['site_name', 'country', 'lat', 'lon'];
  const missingHeaders = required.filter((req) => !headers.includes(req));
  if (missingHeaders.length > 0) {
    return {
      valid: false,
      errors: [`Missing required CSV columns: ${missingHeaders.join(', ')}`],
      rows: [],
    };
  }

  const idx = (col: string) => headers.indexOf(col);
  const parseOptionalNum = (raw: string | undefined): number | null => {
    if (!raw) return null;
    const cleaned = raw.trim();
    if (cleaned === '' || cleaned.toUpperCase() === 'NA' || cleaned.toUpperCase() === 'NULL') {
      return null;
    }
    const num = Number(cleaned);
    return Number.isFinite(num) ? num : null;
  };

  const errors: string[] = [];
  const rows: ParsedCsvDatasetResult['rows'] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map((c) => c.trim());
    const siteName = cols[idx('site_name')] ?? '';
    const country = cols[idx('country')] ?? '';
    const lat = Number(cols[idx('lat')]);
    const lon = Number(cols[idx('lon')]);

    if (!siteName || !country || !Number.isFinite(lat) || !Number.isFinite(lon)) {
      errors.push(`Row ${i + 1}: Invalid site_name, country, lat, or lon.`);
      continue;
    }
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      errors.push(`Row ${i + 1}: Coordinates out of WGS84 bounds (${lat}, ${lon}).`);
      continue;
    }

    rows.push({
      siteName,
      country,
      lat,
      lon,
      elevationM: parseOptionalNum(cols[idx('elevation_m')]),
      slopeDeg: parseOptionalNum(cols[idx('slope_deg')]),
      surfaceTempK: parseOptionalNum(cols[idx('surface_temp_k')]),
      precipitationMmYr: parseOptionalNum(cols[idx('precipitation_mm_yr')]),
      solarIrradianceWm2: parseOptionalNum(cols[idx('solar_irradiance_wm2')]),
    });
  }

  return {
    valid: errors.length === 0 && rows.length > 0,
    errors,
    rows,
  };
}
