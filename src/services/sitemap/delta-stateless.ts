// services/sitemap/delta-stateless.ts
import { SitemapService } from "./sitemap.service";
import { hashUrl } from '../../utils/hash-url';

type RobotsRules = { allows: string[]; disallows: string[]; sitemaps: string[] };
type IsPathAllowed = (pathname: string, rules: RobotsRules) => boolean;

export function deltaFromUrlsetStateless(params: {
  sitemapUrl: string; // sitemap
  rawXml: string; // xml dele.
  rules: RobotsRules; // regras 
  isPathAllowed: IsPathAllowed; 
  seenHashes?: Set<string>;
  hashBits?: 128 | 64;
}) {
  const { sitemapUrl, rawXml, rules, isPathAllowed, seenHashes = new Set<string>(), hashBits = 128 } = params;

  const analysis = SitemapService.analyze(sitemapUrl, rawXml);

  if (analysis.kind !== 'urlset' || !analysis.urls) {
    return { analysis, allUrls: [] as string[], allHashes: [] as string[], newUrls: [] as string[], newHashes: [] as string[] };
  }

  const allUrls = analysis.urls
    .map(u => u.loc)
    .filter(u => u.startsWith('https://'))
    .filter(u => isPathAllowed(new URL(u).pathname, rules));

  const allHashes = allUrls.map(u => hashUrl(u, hashBits));

  const newIndexes = allHashes.map((h, i) => (seenHashes.has(h) ? -1 : i)).filter(i => i >= 0);
  const newUrls = newIndexes.map(i => allUrls[i]);
  const newHashes = newIndexes.map(i => allHashes[i]);

  // nada é salvo aqui; você decide o que fazer com newHashes depois
  return { analysis, allUrls, allHashes, newUrls, newHashes };
}
