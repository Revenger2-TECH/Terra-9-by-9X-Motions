import test from 'node:test';
import assert from 'node:assert/strict';
import { DATASET_REGISTRY, EARTH_SITES, PLANETARY_TARGETS } from '../data/catalog';
import {
  executeQueryDatasetMetadata,
  executeRunSimilarityAnalysis,
  validateWgs84Coordinates,
} from './siTools';

const testCtx = {
  targets: PLANETARY_TARGETS,
  earthSites: EARTH_SITES,
  datasets: DATASET_REGISTRY,
};

test('validateWgs84Coordinates rejects out-of-bounds coordinates and accepts valid coordinates', () => {
  assert.equal(validateWgs84Coordinates(-24.08, -69.92), true);
  assert.equal(validateWgs84Coordinates(90, -180), true);
  assert.equal(validateWgs84Coordinates(91, 0), false);
  assert.equal(validateWgs84Coordinates(0, 181), false);
  assert.equal(validateWgs84Coordinates(Number.NaN, 12), false);
});

test('executeQueryDatasetMetadata finds tmax_tmin_anom.xyz and GeoTIFF planetary summaries', () => {
  const xyzRes = executeQueryDatasetMetadata({ query: 'tmax_tmin_anom.xyz' }, testCtx);
  assert.equal(xyzRes.ok, true);
  const grids = xyzRes.resultPayload.gridSummaries as Array<{
    datasetId: string;
    body: string;
    metrics: { thermalAnomalyMeanC: number; meanSkinTempK: number };
  }>;
  assert.equal(grids.length, 1);
  assert.equal(grids[0].datasetId, 'tmax_tmin_anom.xyz');
  assert.equal(grids[0].body, 'EARTH');
  assert.equal(grids[0].metrics.thermalAnomalyMeanC, 1.15);
  assert.equal(grids[0].metrics.meanSkinTempK, 288.2);

  const marsRes = executeQueryDatasetMetadata({ body: 'MARS' }, testCtx);
  const marsGrids = marsRes.resultPayload.gridSummaries as Array<{ datasetId: string }>;
  assert.equal(marsGrids.some((g) => g.datasetId === 'jezero_elevation_mosaic.tiff'), true);
});

test('executeRunSimilarityAnalysis ranks Jezero candidates and enforces thermal incompatibility guardrail', () => {
  const lstRun = executeRunSimilarityAnalysis(
    { targetId: 'jezero', temperatureMode: 'MODIS_SURFACE_LST', limit: 3 },
    testCtx
  );
  assert.equal(lstRun.ok, true);
  assert.ok(lstRun.record);
  assert.equal(lstRun.record.targetBody, 'MARS');
  assert.equal(lstRun.record.results[0].rank, 1);

  const airRun = executeRunSimilarityAnalysis(
    { targetId: 'jezero', temperatureMode: 'NASA_POWER_AIR_2M' },
    testCtx
  );
  assert.equal(airRun.ok, true);
  const firstSite = airRun.record!.results[0];
  const tempRow = firstSite.featureBreakdown.find((f) => f.feature === 'surfaceTemp');
  assert.equal(tempRow?.compatibilityStatus, 'INCOMPATIBLE_MEASUREMENT_TYPE');
  assert.equal(tempRow?.includedInScore, false);
});

test('executeRunSimilarityAnalysis rejects invalid targetId and zero-sum weights', () => {
  const badTarget = executeRunSimilarityAnalysis({ targetId: 'europa' }, testCtx);
  assert.equal(badTarget.ok, false);
  assert.match(badTarget.error ?? '', /Invalid targetId/);

  const zeroWeights = executeRunSimilarityAnalysis(
    {
      targetId: 'shackleton',
      weights: { elevation: 0, slope: 0, surfaceTemp: 0, precipitation: 0, solarIrradiance: 0 },
    },
    testCtx
  );
  assert.equal(zeroWeights.ok, false);
  assert.match(zeroWeights.error ?? '', /greater than zero/i);
});
