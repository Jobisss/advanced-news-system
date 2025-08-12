import * as cheerio from 'cheerio';

export type SitemapKind = 'index' | 'urlset' | 'unknown';
export type SitemapMode = 'index' | 'sharded' | 'rolling' | 'unknown';

export type UrlItem = { loc: string; lastmod?: string };
export type SitemapAnalysis = {
    url: string;
    kind: SitemapKind;
    mode: SitemapMode;
    reasons: string[];
    namespaces: { news: boolean; video: boolean };
    children?: string[];
    urls?: UrlItem[];
    stats?: { urlCount: number; lastmodDays: number; hasLastmod: boolean };
};

function looksDateShardedUrl(u: string) {
    try {
        const { pathname } = new URL(u);
        return (
            /\b\d{4}\/\d{2}\/\d{2}\b/.test(pathname) ||
            /_\d+\.xml(\.gz)?$/i.test(pathname)
        );
    } catch (error) {
        return false;
    }
}

function countDistinctLastmodDays(lastmods: string[]) {
    const days = new Set(
        lastmods
            .map((s) => new Date(s))
            .filter((d) => !isNaN(d.getTime()))
            .map((d) => d.toISOString().slice(0, 10))
    );
    return days.size;
}

function detectNamespaces(rawXml: string) {
    const news = /(?:xmlns\s*:\s*news\s*=|<\s*news:news\b)/i.test(rawXml);
    const video = /(?:xmlns\s*:\s*video\s*=|<\s*video:video\b)/i.test(rawXml);
    return { news, video };
}

export class SitemapService {
    static parse(rawXml: string) {
        return cheerio.load(rawXml, { xml: true });
    }

    static getKind($: cheerio.CheerioAPI): SitemapKind {
        if ($('sitemapindex').length) return 'index';
        if ($('urlset').length) return 'urlset';
        return 'unknown';
    }

    static extractChildSitemaps($: cheerio.CheerioAPI): string[] {
        return $('sitemapindex > sitemap > loc')
            .map((_, el) => $(el).text().trim())
            .get()
            .filter((u) => u.startsWith('http'));
    }

    static extractUrls($: cheerio.CheerioAPI): UrlItem[] {
        return $('urlset > url')
            .map((_, el) => {
                const loc = $('loc', el).first().text().trim();
                const lastmod =
                    $('lastmod', el).first().text().trim() || undefined;
                return { loc, lastmod };
            })
            .get()
            .filter((u) => u.loc.startsWith('http'));
    }

    static detectMode(sitemapUrl: string, $: cheerio.CheerioAPI, rawXml: string): { mode: SitemapMode; reasons: string[] } {
    const reasons: string[] = [];
    const kind = this.getKind($);

    if (kind === 'index') {
      reasons.push('sitemapindex encontrado');
      return { mode: 'index', reasons };
    }
    if (kind !== 'urlset') {
      reasons.push('não é sitemapindex nem urlset');
      return { mode: 'unknown', reasons };
    }

    const items = this.extractUrls($);
    const lastmods = items.map(i => i.lastmod).filter(Boolean) as string[];
    const days = countDistinctLastmodDays(lastmods);
    const hasLastmod = lastmods.length > 0;

    if (looksDateShardedUrl(sitemapUrl) && (days === 1 || (hasLastmod && days === 0))) {
      reasons.push('URL com padrão de data/tiragem', 'lastmod concentrado em 1 dia');
      return { mode: 'sharded', reasons };
    }

    const urlLower = sitemapUrl.toLowerCase();
    const genericName = /(news\-)?sitemap(\.xml|_news\.xml|_index\.xml|\.xml\.gz)$/i.test(urlLower);
    if (genericName || days >= 2) {
      reasons.push('nome genérico de sitemap ou lastmod em múltiplos dias');
      return { mode: 'rolling', reasons };
    }

    reasons.push('não bateu padrões fortes; unknown');
    return { mode: 'unknown', reasons };
  }

  static analyze(sitemapUrl: string, rawXml: string): SitemapAnalysis {
    const $ = this.parse(rawXml);
    const kind = this.getKind($);
    const namespaces = detectNamespaces(rawXml);
    const reasons: string[] = [];

    let children: string[] | undefined;
    let urls: UrlItem[] | undefined;
    let mode: SitemapMode = 'unknown';
    let stats: SitemapAnalysis['stats'];

    if (kind === 'index') {
      children = this.extractChildSitemaps($);
      mode = 'index';
      reasons.push('sitemapindex encontrado');
    } else if (kind === 'urlset') {
      urls = this.extractUrls($);
      const lastmods = urls.map(u => u.lastmod!).filter(Boolean);
      stats = {
        urlCount: urls.length,
        hasLastmod: lastmods.length > 0,
        lastmodDays: countDistinctLastmodDays(lastmods),
      };
      const det = this.detectMode(sitemapUrl, $, rawXml);
      mode = det.mode;
      reasons.push(...det.reasons);
    } else {
      reasons.push('estrutura XML não reconhecida');
    }

    if (namespaces.news) reasons.push('namespace news presente');
    if (namespaces.video) reasons.push('namespace video presente');

    return { url: sitemapUrl, kind, mode, reasons, namespaces, children, urls, stats };
  }
}
