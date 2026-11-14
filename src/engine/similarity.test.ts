import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_FEATURE_WEIGHTS,
  evaluateEarthAnalogs,
  evaluateSingleSite,
  parseLocalSiteCsv,
} from './similarity';
import { EARTH_SITES, PLANETARY_TARGETS } from '../data/catalog';
import type { EarthSite } from './types';

test('deterministic similarity evaluation ranks sites and preserves bounds [0, 1]', () => {
  const jezero = PLANETARY_TARGETS.find((t) => t.id === 'jezero');
  assert.ok(jezero, 'Jezero target must exist');

  const results = evaluateEarthAnalogs(jezero, EARTH_SITES, DEFAULT_FEATURE_WEIGHTS, 'MODIS_SURFACE_LST');
  assert.equal(results.length, EARTH_SITES.length);

  const ranked = results.filter((r) => r.overallSimilarityScore !== null);
  assert.ok(ranked.length >= 6, 'At least 6 sites should produce valid ranked scores');

  for (let i = 0; i < ranked.length; i++) {
    const score = ranked[i].overallSimilarityScore!;
    assert.ok(score >= 0 && score <= 1, 'Score must be normalized between 0 and 1');
    assert.equal(ranked[i].rank, i + 1, 'Ranks must be sequential starting at 1');
    if (i > 0) {
      assert.ok(
        ranked[i - 1].overallSimilarityScore! >= score,
        'Ranked results must be sorted descending'
      );
    }
  }
});

test('scientific integrity: Earth 2m air temperature is rejected as INCOMPATIBLE against planetary surface temp', () => {
  const jezero = PLANETARY_TARGETS.find((t) => t.id === 'jezero')!;
  const atacama = EARTH_SITES.find((s) => s.id === 'atacama')!;

  const airModeEval = evaluateSingleSite(jezero, atacama, DEFAULT_FEATURE_WEIGHTS, 'NASA_POWER_AIR_2M');
  const tempRow = airModeEval.featureBreakdown.find((f) => f.feature === 'surfaceTemp')!;

  assert.equal(tempRow.compatibilityStatus, 'INCOMPATIBLE_MEASUREMENT_TYPE');
  assert.equal(tempRow.includedInScore, false);
  assert.equal(tempRow.similarityContribution, null);
  assert.ok(
    airModeEval.scientificWarnings.some((w) => w.includes('2m atmospheric air temperature')),
    'Must emit explicit scientific warning when air temp is selected'
  );
});

test('missing values are never zero-filled and weights renormalize over comparable features', () => {
  const jezero = PLANETARY_TARGETS.find((t) => t.id === 'jezero')!;
  const baseSite = EARTH_SITES.find((s) => s.id === 'atacama')!;

  const partialSite: EarthSite = {
    ...baseSite,
    id: 'partial-test',
    parameters: {
      ...baseSite.parameters,
      solarIrradiance: {
        ...baseSite.parameters.solarIrradiance,
        value: null,
        isAvailable: false,
        dataKind: 'UNAVAILABLE',
      },
      precipitation: {
        ...baseSite.parameters.precipitation,
        value: null,
        isAvailable: false,
        dataKind: 'UNAVAILABLE',
      },
    },
  };

  const result = evaluateSingleSite(jezero, partialSite, DEFAULT_FEATURE_WEIGHTS, 'MODIS_SURFACE_LST');
  assert.equal(result.comparableFeatureCount, 3);
  assert.equal(result.totalConfiguredFeatures, 5);
  assert.equal(result.coverageRatio, 0.6);

  const effectiveWeightSum = result.featureBreakdown
    .filter((f) => f.includedInScore)
    .reduce((acc, f) => acc + f.effectiveWeight, 0);

  assert.ok(Math.abs(effectiveWeightSum - 1) < 0.002, 'Effective weights must renormalize to 1.0');
  const precipRow = result.featureBreakdown.find((f) => f.feature === 'precipitation')!;
  assert.equal(precipRow.earthValue, null);
  assert.equal(precipRow.includedInScore, false);
});

test('insufficient data (< 2 comparable features) returns null score instead of misleading number', () => {
  const shackleton = PLANETARY_TARGETS.find((t) => t.id === 'shackleton')!;
  const sparseSite: EarthSite = {
    ...EARTH_SITES[0],
    id: 'sparse-site',
    parameters: {
      ...EARTH_SITES[0].parameters,
      elevation: { ...EARTH_SITES[0].parameters.elevation, value: null, isAvailable: false, dataKind: 'UNAVAILABLE' },
      slope: { ...EARTH_SITES[0].parameters.slope, value: null, isAvailable: false, dataKind: 'UNAVAILABLE' },
      surfaceTemp: { ...EARTH_SITES[0].parameters.surfaceTemp, value: null, isAvailable: false, dataKind: 'UNAVAILABLE' },
      solarIrradiance: { ...EARTH_SITES[0].parameters.solarIrradiance, value: null, isAvailable: false, dataKind: 'UNAVAILABLE' },
    },
  };

  const result = evaluateSingleSite(shackleton, sparseSite, DEFAULT_FEATURE_WEIGHTS, 'MODIS_SURFACE_LST');
  assert.equal(result.confidenceLevel, 'INSUFFICIENT');
  assert.equal(result.overallSimilarityScore, null);
});

test('local CSV parser preserves missing cells as null and rejects invalid coordinates', () => {
  const csv = [
    'site_name,country,lat,lon,elevation_m,slope_deg,surface_temp_k,precipitation_mm_yr,solar_irradiance_wm2',
    'Chajnantor Plateau,Chile,-23.02,-67.75,5058,4.2,276.4,NA,295',
    'Invalid Site,Nowhere,120.0,10.0,100,1,280,10,200',
  ].join('\n');

  const parsed = parseLocalSiteCsv(csv);
  assert.equal(parsed.valid, false);
  assert.equal(parsed.rows.length, 1);
  assert.equal(parsed.rows[0].precipitationMmYr, null);
  assert.equal(parsed.rows[0].elevationM, 5058);
});
