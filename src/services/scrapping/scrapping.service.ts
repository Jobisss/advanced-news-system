import { type Browser, chromium } from 'playwright';

type RobotsRules = {
    allows: string[];
    disallows: string[];
    sitemaps: string[];
};

class ScrappingService {
    constructor(private browser: Browser) {}

    createUrl(stringUrl: string) {
        if (stringUrl.length === 0) {
            throw new Error('Invalid url');
        }

        try {
            const url = new URL(stringUrl);
            return url;
        } catch (error) {
            throw new Error('Invalid url');
        }
    }

    public async createRequestContext() {
        return this.browser.newContext();
    }

    defineBaseUrl(siteUrl: string) {
        const url = this.createUrl(siteUrl);
        if (url.protocol !== 'https:') throw new Error('Invalid url'); // só https
        return url.origin;
    }

    async fetchRobotsTxt(siteUrl: string) {
        const baseUrl = this.defineBaseUrl(siteUrl);
        const robotsUrl = `${baseUrl}/robots.txt`;

        console.log(`Buscando robots.txt em: ${robotsUrl}`);

        const context = await this.browser.newContext();
        try {
            const res = await context.request.get(robotsUrl, {
                timeout: 15000,
                headers: {
                    'User-Agent': 'MeuBot/1.0 (test bot)',
                },
            });
            console.log(`Status: ${res.status()}`);

            if (!res.ok()) {
                throw new Error(`Falha ao buscar robots.txt ${res.status()}`);
            }

            const text = (await res.text()).trim();
            console.log('Tamanho do robots.txt:', text.length);
            return text;
        } finally {
            await context.close();
        }
    }

    async fetchXmlText(sitemapUrl: string) {
        const ctx = await this.createRequestContext();
        try {
            const res = await ctx.request.get(sitemapUrl, {
                timeout: 20000,
                maxRedirects: 3,
                headers: {
                    'User-Agent': 'NewsSitemapBot/1.0 (+contact@example.com)',
                    Accept: 'application/xml,text/xml;q=0.9,*/*;q=0.8',
                },
            });
            if (!res.ok())
                throw new Error(`Erro ${res.status()} ao baixar sitemap`);
            return await res.text();
        } finally {
            await ctx.close();
        }
    }

    async parseRobotsTxt(robotsTxt: string, userAgent = '*') {
        const lines = robotsTxt
            .replace(/\r\n/g, '\n')
            .split('\n')
            .map((l) => l.trim())
            .filter((l) => l && !l.startsWith('#'));

        const blocks: {
            agents: string[];
            allows: string[];
            disallows: string[];
        }[] = [];
        let current = {
            agents: [] as string[],
            allows: [] as string[],
            disallows: [] as string[],
        };

        const pushBlock = () => {
            if (
                current.agents.length ||
                current.allows.length ||
                current.disallows.length
            ) {
                blocks.push(current);
                current = { agents: [], allows: [], disallows: [] };
            }
        };

        const sitemaps: string[] = [];

        for (const line of lines) {
            const [rawKey, ...rest] = line.split(':');
            const value = rest.join(':').trim();
            const key = rawKey?.toLowerCase();

            if (key === 'user-agent') {
                if (current.agents.length) pushBlock();
                current.agents.push(value.toLowerCase());
            }

            if (key === 'allow') current.allows.push(value);
            if (key === 'disallow') current.disallows.push(value);
            if (key === 'sitemap') sitemaps.push(value);
        }
        pushBlock();

        const matchUa = (agents: string[]) =>
            agents.some((a) => a === '*' || a === userAgent.toLowerCase());

        const selected = blocks.filter((b) => matchUa(b.agents));
        const starBlocks = blocks.filter((b) => b.agents.includes('*'));
        const effective = selected.length ? selected : starBlocks;

        const allows = effective.flatMap((b) => b.allows);
        const disallows = effective.flatMap((b) => b.disallows);

        return {
            allows,
            disallows,
            sitemaps,
        };
    }

    isPathAllowed(pathname: string, rules: RobotsRules) {
        const p = pathname || '/';

        const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

        const matches = (rule: string) => {
            if (rule === '') return false; // regra vazia em Disallow = sem restrição
            if (rule === '/') return p.startsWith('/'); // bloqueia tudo
            if (rule.endsWith('$')) return p === rule.slice(0, -1);

            if (rule.includes('*')) {
                const re = new RegExp(
                    '^' + rule.split('*').map(esc).join('.*')
                );
                return re.test(p);
            }
            return p.startsWith(rule);
        };

        const dis = rules.disallows.filter((r) => r !== '');

        const longest = (cands: string[]) =>
            cands.reduce(
                (acc, r) => (matches(r) && r.length > acc.length ? r : acc),
                ''
            );

        const bestDis = longest(dis);
        if (!bestDis) return true; // nenhum disallow aplicável → permitido

        const bestAllow = longest(rules.allows);
        if (!bestAllow) return false; // há disallow e nenhum allow → bloqueado

        // mais longo vence; em empate, Allow ganha
        return bestAllow.length >= bestDis.length;
    }

    async fetchAllowedUrlsFromSitemap(sitemapUrl: string, rules: RobotsRules) {
        const context = await this.createRequestContext();
        try {
            const res = await context.request.get(sitemapUrl, {
                timeout: 20000,
                maxRedirects: 3,
            });
            if (!res.ok())
                throw new Error(`Erro ${res.status()} ao baixar sitemap`);
            const xml = await res.text();

            const locs = Array.from(xml.matchAll(/<loc>(.*?)<\/loc>/g))
                .map((m) => (m[1] ? m[1].trim() : ''))
                .filter((u) => u.startsWith('https://'));
            return locs.filter((u) =>
                this.isPathAllowed(new URL(u).pathname, rules)
            );
        } finally {
            await context.close();
        }
    }
}

const browser = await chromium.launch();
const scrappingService = new ScrappingService(browser);

export default scrappingService;
export { ScrappingService };
