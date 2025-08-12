import scrappingService from "./services/scrapping/scrapping.service";
import { deltaFromUrlsetStateless } from "./services/sitemap/delta-stateless";

const robotsTxt = await scrappingService.fetchRobotsTxt('https://g1.globo.com');
const rules = await scrappingService.parseRobotsTxt(robotsTxt);

const sitemapUrl = 'https://g1.globo.com/sitemap/g1/2025/07/22_1.xml';
const xml = await scrappingService.fetchXmlText(sitemapUrl) // use seu método que baixa XML! (ex.: fetchXmlText)
  .catch(() => ''); 

  const { analysis, newUrls, newHashes, allUrls, allHashes } =
  deltaFromUrlsetStateless({
    sitemapUrl,
    rawXml: xml,
    rules,
    isPathAllowed: scrappingService.isPathAllowed.bind(scrappingService),
});

console.log(analysis.mode, analysis.kind, analysis.reasons);
console.log('Novas urls: ', newUrls.slice(0, 10));
