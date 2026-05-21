import * as cheerio from 'cheerio';

export interface CrawlResult {
  url: string;
  title: string;
  text: string;
  imageUrls: string[];
  links: string[];
  crawledAt: string;
}

export async function crawlPage(url: string): Promise<CrawlResult> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'MultimodalQAAgent/1.0' },
  });
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);

  const html = await res.text();
  const $ = cheerio.load(html);

  $('script, style, noscript, nav, footer, header').remove();

  const title = $('title').text().trim();
  const text = $('body').text().replace(/\s+/g, ' ').trim();

  const imageUrls: string[] = [];
  $('img[src]').each((_, el) => {
    const src = $(el).attr('src');
    if (src) {
      try {
        imageUrls.push(new URL(src, url).href);
      } catch {
        // ignore
      }
    }
  });

  const links: string[] = [];
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    if (href && !href.startsWith('#') && !href.startsWith('javascript:')) {
      try {
        links.push(new URL(href, url).href);
      } catch {
        // ignore
      }
    }
  });

  return {
    url,
    title,
    text: text.slice(0, 50000),
    imageUrls: [...new Set(imageUrls)].slice(0, 50),
    links: [...new Set(links)].slice(0, 100),
    crawledAt: new Date().toISOString(),
  };
}
