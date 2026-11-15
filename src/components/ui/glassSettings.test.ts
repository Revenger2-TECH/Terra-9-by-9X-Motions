import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_GLASS_SETTINGS, normalizeGlassSettings } from './glassSettings';

test('normalizeGlassSettings clamps blur, opacity, saturation, and edge within bounds', () => {
  const clampedHigh = normalizeGlassSettings({
    blur: 100,
    opacity: 2,
    saturation: 5,
    edge: 9,
    tint: '#22D3EE',
  });
  assert.deepEqual(clampedHigh, {
    blur: 40,
    opacity: 0.95,
    saturation: 2,
    edge: 1,
    tint: '#22D3EE',
  });

  const clampedLow = normalizeGlassSettings({
    blur: -10,
    opacity: 0,
    saturation: 0,
    edge: -1,
    tint: 'invalid-color',
  });
  assert.deepEqual(clampedLow, {
    blur: 0,
    opacity: 0.08,
    saturation: 0.5,
    edge: 0,
    tint: DEFAULT_GLASS_SETTINGS.tint,
  });
});

test('normalizeGlassSettings falls back to defaults for NaN values', () => {
  const normalized = normalizeGlassSettings({
    blur: Number.NaN,
    opacity: Number.POSITIVE_INFINITY,
  });
  assert.equal(normalized.blur, DEFAULT_GLASS_SETTINGS.blur);
  assert.equal(normalized.opacity, DEFAULT_GLASS_SETTINGS.opacity);
});
