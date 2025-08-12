import { expect, test, describe, beforeAll, afterAll } from 'bun:test';
import { chromium, type Browser } from 'playwright';
import { ScrappingService } from '../scrapping/scrapping.service'; // ajuste o caminho conforme seu projeto

let browser: Browser;
let service: ScrappingService;

beforeAll(async () => {
  browser = await chromium.launch();
  service = new ScrappingService(browser);
});

afterAll(async () => {
  await browser.close();
});

describe('scrappingService', () => {
  describe('defineBaseUrl', () => {
    test('retorna origin para URLs HTTPS válidas', () => {
      expect(service.defineBaseUrl('https://www.google.com')).toBe('https://www.google.com');
      expect(service.defineBaseUrl('https://www.google.com/search')).toBe('https://www.google.com');
    });

    test('lança erro para URLs inválidas ou não-HTTPS', () => {
      expect(() => service.defineBaseUrl('')).toThrow('Invalid url');
      expect(() => service.defineBaseUrl('www.google.com')).toThrow('Invalid url');
      expect(() => service.defineBaseUrl('http://www.google.com')).toThrow('Invalid url');
    });
  });

  describe('parseRobotsTxt', () => {
    test('extrai regras corretas e sitemaps', async () => {
      const robotsTxt = `
        User-agent: *
        Allow: /public
        Disallow: /private
        Sitemap: https://example.com/sitemap.xml
      `;

      const rules = await service.parseRobotsTxt(robotsTxt);
      expect(rules.allows).toContain('/public');
      expect(rules.disallows).toContain('/private');
      expect(rules.sitemaps).toContain('https://example.com/sitemap.xml');
    });

    test('considera apenas blocos que batem com o user-agent', async () => {
      const robotsTxt = `
        User-agent: googlebot
        Disallow: /no-google
        User-agent: *
        Allow: /yes
      `;

      const rules = await service.parseRobotsTxt(robotsTxt, '*');
      expect(rules.allows).toContain('/yes');
      expect(rules.disallows).not.toContain('/no-google');
    });
  });

  describe('isPathAllowed', () => {
    const rules = {
      allows: ['/public', '/exact$'],
      disallows: ['/private', '/exact$'],
      sitemaps: [],
    };

    test('permite quando não há disallow aplicável', () => {
      expect(service.isPathAllowed('/public/page', { ...rules, disallows: [] })).toBe(true);
    });

    test('bloqueia quando há disallow e nenhum allow correspondente', () => {
      expect(service.isPathAllowed('/private/data', { ...rules, allows: [] })).toBe(false);
    });

    test('allow mais específico vence disallow menos específico', () => {
      const customRules = {
        allows: ['/public/page'],
        disallows: ['/public'],
        sitemaps: [],
      };
      expect(service.isPathAllowed('/public/page', customRules)).toBe(true);
    });

    test('desempate de tamanho igual favorece allow', () => {
      const customRules = {
        allows: ['/exact$'],
        disallows: ['/exact$'],
        sitemaps: [],
      };
      expect(service.isPathAllowed('/exact', customRules)).toBe(true);
    });

    test('wildcard funciona corretamente', () => {
      const customRules = {
        allows: ['/allow*'],
        disallows: ['/block*'],
        sitemaps: [],
      };
      expect(service.isPathAllowed('/allow-anything', customRules)).toBe(true);
      expect(service.isPathAllowed('/block-anything', customRules)).toBe(false);
    });
  });

  describe('fetchRobotsTxt e fetchAllowedUrlsFromSitemap', () => {
    test('busca robots.txt de um site real (https)', async () => {
      const text = await service.fetchRobotsTxt('https://www.bbc.com');
      expect(typeof text).toBe('string');
      expect(text.length).toBeGreaterThan(0);
    }, 15000);

    test('filtra apenas URLs HTTPS do sitemap', async () => {
      const fakeXml = `
        <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
          <url><loc>https://example.com/page1</loc></url>
          <url><loc>http://example.com/page2</loc></url>
        </urlset>
      `;

      // Mock do request
      service.createRequestContext = async () => ({
        request: {
          get: async () => ({
            ok: () => true,
            text: async () => fakeXml,
          }),
        },
        close: async () => {},
      }) as any;

      const rules = { allows: ['/'], disallows: [], sitemaps: [] };
      const urls = await service.fetchAllowedUrlsFromSitemap('https://example.com/sitemap.xml', rules);
      expect(urls).toContain('https://example.com/page1');
      expect(urls).not.toContain('http://example.com/page2');
    });
  });
});
