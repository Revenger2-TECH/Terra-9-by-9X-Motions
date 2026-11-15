import test from 'node:test';
import assert from 'node:assert/strict';
import { EARTH_SITES } from '../../data/catalog';
import { parseMarkdownBlocks, tokenizeInlineWithCitations } from './siMarkdown';

test('parseMarkdownBlocks parses headings, tables, lists, and paragraphs cleanly', () => {
  const md = [
    '## Analog Ranking Summary',
    '',
    'Leading candidate is Atacama Desert.',
    '',
    '| Rank | Site | Score |',
    '| :--- | :--- | :--- |',
    '| #1 | Atacama Desert | 78.4% |',
    '',
    '- Provenance: MODIS MOD11A2',
    '- Datum: WGS84',
    '',
    '---',
  ].join('\n');

  const blocks = parseMarkdownBlocks(md);
  assert.equal(blocks[0].type, 'heading');
  assert.equal(blocks[1].type, 'paragraph');
  assert.equal(blocks[2].type, 'table');
  assert.equal(blocks[3].type, 'list');
  assert.equal(blocks[4].type, 'hr');
  if (blocks[2].type === 'table') {
    assert.deepEqual(blocks[2].headers, ['Rank', 'Site', 'Score']);
    assert.equal(blocks[2].rows.length, 1);
  }
});

test('tokenizeInlineWithCitations resolves terra9 links, site names, and valid coordinates while ignoring out-of-bounds numbers', () => {
  const text =
    'Inspect [Atacama Desert](terra9://site/atacama), McMurdo Dry Valleys at 77.50°S, 161.80°E, or (-20.13, -67.49). Invalid 95.00, 210.00 is plain text.';
  const tokens = tokenizeInlineWithCitations(text, EARTH_SITES);
  const citations = tokens.filter((t) => t.type === 'citation');

  assert.equal(citations.length, 4);
  if (citations[0].type === 'citation') {
    assert.equal(citations[0].citation.siteId, 'atacama');
    assert.equal(citations[0].citation.lat, -24.08);
  }
  if (citations[1].type === 'citation') {
    assert.equal(citations[1].citation.siteId, 'mcmurdo');
  }
  if (citations[2].type === 'citation') {
    assert.equal(citations[2].citation.siteId, 'mcmurdo');
    assert.equal(citations[2].citation.lat, -77.5);
  }
  if (citations[3].type === 'citation') {
    assert.equal(citations[3].citation.siteId, 'uyuni');
  }
});
