export type PlanetaryBody = 'MOON' | 'MARS' | 'EARTH';

export type TargetId = 'shackleton' | 'jezero';

export type MeasurementType =
  | 'ELEVATION_DATUM_M'
  | 'TERRAIN_SLOPE_DEG'
  | 'SURFACE_RADIOMETRIC_TEMP_K'
  | 'AIR_TEMP_2M_C'
  | 'PRECIPITATION_MM_YR'
  | 'SOLAR_IRRADIANCE_WM2';

export type CompatibilityStatus =
  | 'COMPATIBLE'
  | 'COMPATIBLE_WITH_CAVEAT'
  | 'INCOMPATIBLE_MEASUREMENT_TYPE'
  | 'DATA_UNAVAILABLE';

export type FeatureKey =
  | 'elevation'
  | 'slope'
  | 'surfaceTemp'
  | 'precipitation'
  | 'solarIrradiance';

export interface ScientificMeasurement {
  value: number | null;
  min?: number | null;
  max?: number | null;
  unit: string;
  measurementType: MeasurementType;
  source: string;
  provenanceNote: string;
  isAvailable: boolean;
  dataKind: 'OBSERVATIONAL_REFERENCE' | 'LOCAL_USER_DATASET' | 'NOT_APPLICABLE' | 'UNAVAILABLE';
}

export interface PlanetaryTarget {
  id: TargetId;
  body: 'MOON' | 'MARS';
  name: string;
  region: string;
  coordinates: {
    lat: number;
    lon: number;
    formatted: string;
  };
  diameterKm: number;
  summary: string;
  geologicalContext: string;
  datasets: string[];
  parameters: {
    elevation: ScientificMeasurement;
    slope: ScientificMeasurement;
    surfaceTemp: ScientificMeasurement;
    precipitation: ScientificMeasurement;
    solarIrradiance: ScientificMeasurement;
  };
  unavailableBands: Array<{
    instrument: string;
    product: string;
    reason: string;
  }>;
}

export type TerrainCategory =
  | 'Hyper-Arid Desert'
  | 'Polar / Cryogenic'
  | 'Volcanic / Basaltic'
  | 'High-Altitude / Evaporite';

export interface EarthSite {
  id: string;
  name: string;
  subregion: string;
  country: string;
  coordinates: {
    lat: number;
    lon: number;
    formatted: string;
  };
  terrainCategory: TerrainCategory;
  geologySummary: string;
  analogRelevance: {
    moon: string;
    mars: string;
  };
  parameters: {
    elevation: ScientificMeasurement;
    slope: ScientificMeasurement;
    surfaceTemp: ScientificMeasurement; // MODIS MOD11A2 Land Surface Temperature (K)
    airTemp2m: ScientificMeasurement; // NASA POWER 2m Air Temperature (C) - NOT interchangeable with planetary LST
    precipitation: ScientificMeasurement;
    solarIrradiance: ScientificMeasurement;
  };
  dataCompletenessPct: number;
  datasetsUsed: string[];
}

export type FeatureWeights = Record<FeatureKey, number>;

export type TemperatureComparisonMode = 'MODIS_SURFACE_LST' | 'NASA_POWER_AIR_2M';

export interface FeatureComparisonResult {
  feature: FeatureKey;
  label: string;
  planetaryValue: number | null;
  planetaryUnit: string;
  planetarySource: string;
  planetaryMeasurementType: MeasurementType;
  earthValue: number | null;
  earthUnit: string;
  earthSource: string;
  earthMeasurementType: MeasurementType;
  absoluteDifference: number | null;
  differenceUnit: string;
  compatibilityStatus: CompatibilityStatus;
  compatibilityNote: string;
  configuredWeight: number;
  effectiveWeight: number;
  normalizedDistance: number | null; // 0 (identical) to 1 (max range)
  similarityContribution: number | null; // 0 to 1
  weightedContribution: number | null; // effectiveWeight * similarityContribution
  includedInScore: boolean;
}

export type ConfidenceLevel = 'HIGH' | 'MODERATE' | 'LOW' | 'INSUFFICIENT';

export interface SiteSimilarityEvaluation {
  siteId: string;
  siteName: string;
  country: string;
  coordinates: EarthSite['coordinates'];
  terrainCategory: TerrainCategory;
  rank: number | null;
  overallSimilarityScore: number | null; // 0.000 to 1.000, null if insufficient comparable features
  comparableFeatureCount: number;
  totalConfiguredFeatures: number;
  coverageRatio: number; // 0 to 1
  confidenceLevel: ConfidenceLevel;
  confidenceNotes: string[];
  scientificWarnings: string[];
  featureBreakdown: FeatureComparisonResult[];
  rankingExplanation: string;
}

export interface AnalysisRunRecord {
  analysisId: string;
  createdAtUtc: string;
  targetId: TargetId;
  targetName: string;
  targetBody: 'MOON' | 'MARS';
  weights: FeatureWeights;
  temperatureMode: TemperatureComparisonMode;
  eligibleRankedCount: number;
  totalEvaluatedCount: number;
  methodologyVersion: string;
  results: SiteSimilarityEvaluation[];
}

export interface DatasetRegistryEntry {
  id: string;
  name: string;
  body: PlanetaryBody;
  sourceAgency: string;
  instrument: string;
  fileFormat: 'GeoTIFF' | 'CSV' | 'JSON' | 'PDS4 / IMG';
  spatialCoverage: string;
  measurementUnits: string;
  processingStatus: 'VALIDATED' | 'INDEXED' | 'PARTIAL' | 'PENDING_ACQUISITION';
  availabilityStatus: 'LOADED_LOCAL' | 'API_READY' | 'PARTIAL_COVERAGE' | 'UNAVAILABLE';
  freshness: string;
  provenanceUrl: string;
  notes: string;
  recordCount?: number;
}

export interface ActivityEvent {
  id: string;
  timestampUtc: string;
  category: 'DATASET' | 'TARGET' | 'ANALYSIS' | 'REPORT' | 'EXTERNAL_API';
  message: string;
  detail: string;
}

export interface MissionReport {
  reportId: string;
  createdAtUtc: string;
  analysisId: string;
  targetId: TargetId;
  targetName: string;
  targetBody: 'MOON' | 'MARS';
  siteId: string;
  siteName: string;
  country: string;
  overallSimilarityScore: number | null;
  rank: number | null;
  totalCandidatesEvaluated: number;
  coverageRatio: number;
  confidenceLevel: ConfidenceLevel;
  temperatureMode: TemperatureComparisonMode;
  weights: FeatureWeights;
  datasetReferences: DatasetRegistryEntry[];
  featureComparisons: FeatureComparisonResult[];
  methodologySummary: string;
  scientificLimitations: string[];
  sourceReferences: string[];
}
