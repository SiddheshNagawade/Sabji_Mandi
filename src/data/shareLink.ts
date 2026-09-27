// A read-only, no-account, no-server way to share a market's Data-screen
// report: the report is serialized to JSON, gzip-compressed (when the
// browser supports CompressionStream; falls back to uncompressed), and
// base64url-encoded straight into the URL's hash fragment — never sent to
// a server, so this works for a purely static, client-only app. Whoever
// opens the link gets a read-only view (src/screens/SharedReportScreen.tsx)
// reconstructed entirely from that fragment; nothing is uploaded anywhere.

import type { Project, ProvenanceTag } from './schema';
import { computeLayoutStats } from './layoutStats';
import { countProvenance } from './provenance';
import { generateSuggestions } from './suggestions';
import { renderLayoutThumbnailDataUrl } from './reportImage';
import { produceLabel } from '../editor/labels';
import { buildInsights } from '../screens/DataScreen';

export const SHARE_HASH_PREFIX = '#shared=';

export interface ShareableReport {
  version: 1;
  name: string;
  generatedAt: string;
  areaM2: number;
  walkableFraction: number;
  stallCount: number;
  pedEntranceCount: number;
  vehEntranceCount: number;
  tileBreakdown: { name: string; color: string; fraction: number }[];
  produceMix: { label: string; count: number }[];
  provenance: Record<ProvenanceTag, number>;
  suggestions: { severity: 'high' | 'medium'; message: string }[];
  insights: string[];
  thumbnail: string;
}

export function buildShareableReport(project: Project): ShareableReport {
  const stats = computeLayoutStats(project);
  const provenance = countProvenance(project);
  const totalParams = provenance.measured + provenance.assumed + provenance.literature;
  const suggestions = generateSuggestions(project).slice(0, 5);
  const insights = buildInsights(stats, provenance, totalParams, []);
  const produceMix = (Object.entries(stats.produceCounts) as [string, number][])
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([p, n]) => ({ label: produceLabel(p), count: n }));

  return {
    version: 1,
    name: project.meta.name,
    generatedAt: new Date().toISOString(),
    areaM2: stats.areaM2,
    walkableFraction: stats.walkableFraction,
    stallCount: stats.stallCount,
    pedEntranceCount: stats.pedEntranceCount,
    vehEntranceCount: stats.vehEntranceCount,
    tileBreakdown: stats.tileBreakdown.filter((t) => t.fraction > 0).map((t) => ({ name: t.name, color: t.color, fraction: t.fraction })),
    produceMix,
    provenance,
    suggestions: suggestions.map((s) => ({ severity: s.severity, message: s.message })),
    insights,
    thumbnail: renderLayoutThumbnailDataUrl(project, 480, 280),
  };
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(str: string): Uint8Array {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export async function encodeShareableReport(report: ShareableReport): Promise<string> {
  const json = JSON.stringify(report);
  const raw = new TextEncoder().encode(json);
  if (typeof CompressionStream === 'undefined') {
    return `r${base64UrlEncode(raw)}`;
  }
  const cs = new CompressionStream('gzip');
  const writer = cs.writable.getWriter();
  void writer.write(raw);
  void writer.close();
  const compressed = new Uint8Array(await new Response(cs.readable).arrayBuffer());
  return `g${base64UrlEncode(compressed)}`;
}

export async function decodeShareableReport(encoded: string): Promise<ShareableReport | null> {
  try {
    const tag = encoded[0];
    const bytes = base64UrlDecode(encoded.slice(1));
    let jsonBytes: Uint8Array;
    if (tag === 'g') {
      if (typeof DecompressionStream === 'undefined') return null;
      const ds = new DecompressionStream('gzip');
      const writer = ds.writable.getWriter();
      void writer.write(bytes.slice());
      void writer.close();
      jsonBytes = new Uint8Array(await new Response(ds.readable).arrayBuffer());
    } else {
      jsonBytes = bytes;
    }
    const parsed: unknown = JSON.parse(new TextDecoder().decode(jsonBytes));
    if (typeof parsed === 'object' && parsed !== null && (parsed as { version?: unknown }).version === 1) {
      return parsed as ShareableReport;
    }
    return null;
  } catch {
    return null;
  }
}

export async function buildShareUrl(project: Project): Promise<string> {
  const report = buildShareableReport(project);
  const encoded = await encodeShareableReport(report);
  return `${window.location.origin}${window.location.pathname}${SHARE_HASH_PREFIX}${encoded}`;
}
