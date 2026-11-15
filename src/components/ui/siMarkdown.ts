import type { EarthSite, TargetId } from '../../engine/types';

export interface MapCitationTarget {
  kind: 'site' | 'coords' | 'target';
  label: string;
  lat: number;
  lon: number;
  siteId?: string;
  targetId?: TargetId;
  zoom?: number;
}

export type InlineToken =
  | { type: 'text'; value: string }
  | { type: 'bold'; value: string }
  | { type: 'code'; value: string }
  | { type: 'citation'; label: string; citation: MapCitationTarget };

export type MarkdownBlock =
  | { type: 'heading'; level: 1 | 2 | 3; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'list'; ordered: boolean; items: string[] }
  | { type: 'code'; lang: string; code: string }
  | { type: 'table'; headers: string[]; rows: string[][] }
  | { type: 'hr' };

function isValidWgs84(lat: number, lon: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    lat >= -90 &&
    lat <= 90 &&
    lon >= -180 &&
    lon <= 180
  );
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function findMatchingSiteByCoords(
  lat: number,
  lon: number,
  sites: EarthSite[]
): EarthSite | undefined {
  let best: EarthSite | undefined;
  let bestDist = Infinity;
  for (const s of sites) {
    const d = Math.hypot(s.coordinates.lat - lat, s.coordinates.lon - lon);
    if (d < 0.25 && d < bestDist) {
      bestDist = d;
      best = s;
    }
  }
  return best;
}

export function parseMarkdownBlocks(markdown: string): MarkdownBlock[] {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const blocks: MarkdownBlock[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      i += 1;
      continue;
    }

    // Fenced code block
    if (trimmed.startsWith('```')) {
      const lang = trimmed.slice(3).trim();
      const codeLines: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i += 1;
      }
      if (i < lines.length) i += 1;
      blocks.push({ type: 'code', lang, code: codeLines.join('\n') });
      continue;
    }

    // Horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      blocks.push({ type: 'hr' });
      i += 1;
      continue;
    }

    // Headings
    const headingMatch = trimmed.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length as 1 | 2 | 3;
      blocks.push({ type: 'heading', level, text: headingMatch[2].trim() });
      i += 1;
      continue;
    }

    // Markdown table
    if (
      trimmed.includes('|') &&
      i + 1 < lines.length &&
      /^\s*\|?[\s:-]+\|[\s|:-]*$/.test(lines[i + 1])
    ) {
      const parseCells = (row: string) =>
        row
          .trim()
          .replace(/^\|/, '')
          .replace(/\|$/, '')
          .split('|')
          .map((c) => c.trim());

      const headers = parseCells(trimmed);
      i += 2; // skip header + separator
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().includes('|')) {
        const rowTrim = lines[i].trim();
        if (!rowTrim) break;
        rows.push(parseCells(rowTrim));
        i += 1;
      }
      blocks.push({ type: 'table', headers, rows });
      continue;
    }

    // Unordered or ordered list
    const isUl = /^[-*•]\s+/.test(trimmed);
    const isOl = /^\d+\.\s+/.test(trimmed);
    if (isUl || isOl) {
      const ordered = isOl;
      const items: string[] = [];
      while (i < lines.length) {
        const curr = lines[i].trim();
        const match = ordered
          ? curr.match(/^\d+\.\s+(.+)$/)
          : curr.match(/^[-*•]\s+(.+)$/);
        if (!match) break;
        items.push(match[1].trim());
        i += 1;
      }
      blocks.push({ type: 'list', ordered, items });
      continue;
    }

    // Paragraph (coalesce consecutive non-special lines)
    const paraLines: string[] = [];
    while (i < lines.length) {
      const curr = lines[i].trim();
      if (
        !curr ||
        curr.startsWith('```') ||
        /^(-{3,}|\*{3,}|_{3,})$/.test(curr) ||
        /^#{1,3}\s+/.test(curr) ||
        /^[-*•]\s+/.test(curr) ||
        /^\d+\.\s+/.test(curr) ||
        (curr.includes('|') &&
          i + 1 < lines.length &&
          /^\s*\|?[\s:-]+\|[\s|:-]*$/.test(lines[i + 1]))
      ) {
        break;
      }
      paraLines.push(curr);
      i += 1;
    }
    if (paraLines.length > 0) {
      blocks.push({ type: 'paragraph', text: paraLines.join(' ') });
    } else {
      i += 1;
    }
  }

  return blocks;
}

export function tokenizeInlineWithCitations(
  text: string,
  sites: EarthSite[]
): InlineToken[] {
  const siteSorted = [...sites].sort((a, b) => b.name.length - a.name.length);
  const siteNamesPattern =
    siteSorted.length > 0
      ? siteSorted.map((s) => escapeRegExp(s.name)).join('|')
      : null;

  // Build composite regex scanning left-to-right without overlapping tokens:
  // 1) Explicit terra9:// markdown link: [label](terra9://site/id | coords/lat,lon | target/id)
  // 2) Inline code: `...`
  // 3) Bold: **...**
  // 4) Hemisphere coordinates: 24.08°S, 69.92°W or 24.08 S, 69.92 W
  // 5) Signed decimal coordinate pairs: (-24.08, -69.92) or -24.08, -69.92
  // 6) Known Earth site names from workspace registry
  const parts: string[] = [
    String.raw`\[([^\]]+)\]\((terra9:\/\/(?:site|coords|target)\/[^)\s]+)\)`,
    String.raw`` + '`([^`]+)`',
    String.raw`\*\*([^*]+)\*\*`,
    String.raw`(\d{1,2}(?:\.\d+)?)\s*°?\s*([NSns])\s*,\s*(\d{1,3}(?:\.\d+)?)\s*°?\s*([EWew])`,
    String.raw`(-?\d{1,2}\.\d{1,6})\s*°?\s*,\s*(-?\d{1,3}\.\d{1,6})\s*°?`,
  ];

  if (siteNamesPattern) {
    parts.push(`\\b(${siteNamesPattern})\\b`);
  }

  const masterRegex = new RegExp(parts.join('|'), 'gi');
  const tokens: InlineToken[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = masterRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({ type: 'text', value: text.slice(lastIndex, match.index) });
    }

    const [
      fullMatch,
      linkLabel,
      terraUri,
      codeText,
      boldText,
      dmsLatStr,
      dmsLatHemi,
      dmsLonStr,
      dmsLonHemi,
      decLatStr,
      decLonStr,
      matchedSiteName,
    ] = match;

    if (linkLabel && terraUri) {
      const citation = parseTerraUri(linkLabel, terraUri, sites);
      if (citation) {
        tokens.push({ type: 'citation', label: linkLabel, citation });
      } else {
        tokens.push({ type: 'text', value: linkLabel });
      }
    } else if (codeText !== undefined) {
      tokens.push({ type: 'code', value: codeText });
    } else if (boldText !== undefined) {
      tokens.push({ type: 'bold', value: boldText });
    } else if (dmsLatStr && dmsLatHemi && dmsLonStr && dmsLonHemi) {
      const rawLat = Number(dmsLatStr);
      const rawLon = Number(dmsLonStr);
      const lat = dmsLatHemi.toUpperCase() === 'S' ? -rawLat : rawLat;
      const lon = dmsLonHemi.toUpperCase() === 'W' ? -rawLon : rawLon;
      if (isValidWgs84(lat, lon)) {
        const matchedSite = findMatchingSiteByCoords(lat, lon, sites);
        const planetary = detectPlanetaryTargetCoords(lat, lon);
        tokens.push({
          type: 'citation',
          label: fullMatch,
          citation: planetary
            ? {
                kind: 'target',
                label: planetary === 'shackleton' ? 'Shackleton Crater (Moon)' : 'Jezero Crater (Mars)',
                lat,
                lon,
                targetId: planetary,
              }
            : {
                kind: matchedSite ? 'site' : 'coords',
                label: matchedSite ? matchedSite.name : fullMatch,
                lat,
                lon,
                siteId: matchedSite?.id,
                zoom: 4.5,
              },
        });
      } else {
        tokens.push({ type: 'text', value: fullMatch });
      }
    } else if (decLatStr && decLonStr) {
      const lat = Number(decLatStr);
      const lon = Number(decLonStr);
      if (isValidWgs84(lat, lon)) {
        const matchedSite = findMatchingSiteByCoords(lat, lon, sites);
        const planetary = detectPlanetaryTargetCoords(lat, lon);
        tokens.push({
          type: 'citation',
          label: fullMatch,
          citation: planetary
            ? {
                kind: 'target',
                label: planetary === 'shackleton' ? 'Shackleton Crater (Moon)' : 'Jezero Crater (Mars)',
                lat,
                lon,
                targetId: planetary,
              }
            : {
                kind: matchedSite ? 'site' : 'coords',
                label: matchedSite ? matchedSite.name : fullMatch,
                lat,
                lon,
                siteId: matchedSite?.id,
                zoom: 4.5,
              },
        });
      } else {
        tokens.push({ type: 'text', value: fullMatch });
      }
    } else if (matchedSiteName) {
      const site = sites.find(
        (s) => s.name.toLowerCase() === matchedSiteName.toLowerCase()
      );
      if (site) {
        tokens.push({
          type: 'citation',
          label: fullMatch,
          citation: {
            kind: 'site',
            label: site.name,
            lat: site.coordinates.lat,
            lon: site.coordinates.lon,
            siteId: site.id,
            zoom: 4.5,
          },
        });
      } else {
        tokens.push({ type: 'text', value: fullMatch });
      }
    } else {
      tokens.push({ type: 'text', value: fullMatch });
    }

    lastIndex = match.index + fullMatch.length;
  }

  if (lastIndex < text.length) {
    tokens.push({ type: 'text', value: text.slice(lastIndex) });
  }

  return tokens;
}

function detectPlanetaryTargetCoords(lat: number, lon: number): TargetId | null {
  if (Math.abs(lat - -89.54) < 0.25 && Math.abs(lon - 129.78) < 0.25) {
    return 'shackleton';
  }
  if (Math.abs(lat - 18.38) < 0.25 && Math.abs(lon - 77.58) < 0.25) {
    return 'jezero';
  }
  return null;
}

function parseTerraUri(
  label: string,
  uri: string,
  sites: EarthSite[]
): MapCitationTarget | null {
  if (uri.startsWith('terra9://site/')) {
    const id = uri.slice('terra9://site/'.length).trim().toLowerCase();
    const site = sites.find((s) => s.id.toLowerCase() === id);
    if (!site) return null;
    return {
      kind: 'site',
      label: site.name,
      lat: site.coordinates.lat,
      lon: site.coordinates.lon,
      siteId: site.id,
      zoom: 4.5,
    };
  }

  if (uri.startsWith('terra9://coords/')) {
    const [latStr, lonStr] = uri.slice('terra9://coords/'.length).split(',');
    const lat = Number(latStr);
    const lon = Number(lonStr);
    if (!isValidWgs84(lat, lon)) return null;
    const matched = findMatchingSiteByCoords(lat, lon, sites);
    return {
      kind: matched ? 'site' : 'coords',
      label: matched ? matched.name : label,
      lat,
      lon,
      siteId: matched?.id,
      zoom: 4.5,
    };
  }

  if (uri.startsWith('terra9://target/')) {
    const targetId = uri.slice('terra9://target/'.length).trim().toLowerCase();
    if (targetId === 'shackleton') {
      return {
        kind: 'target',
        label: 'Shackleton Crater',
        lat: -89.54,
        lon: 129.78,
        targetId: 'shackleton',
      };
    }
    if (targetId === 'jezero') {
      return {
        kind: 'target',
        label: 'Jezero Crater',
        lat: 18.38,
        lon: 77.58,
        targetId: 'jezero',
      };
    }
  }

  return null;
}
