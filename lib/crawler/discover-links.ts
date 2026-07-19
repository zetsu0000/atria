import {
  isSameOrigin,
  isSkippableHref,
  normalizeCrawlUrl,
  shouldSkipPath,
} from "./url-policy";

const PRIORITY_PATTERNS: Array<{ re: RegExp; score: number }> = [
  { re: /^\/$/, score: 100 },
  { re: /servi[cç]o|service|tratament|procediment/i, score: 90 },
  { re: /especialid|specialt/i, score: 85 },
  { re: /sobre|about|quem-somos|clinic/i, score: 80 },
  { re: /equipe|time|team|corpo-clinico|doctors?/i, score: 75 },
  { re: /contato|contact|localiza|address|mapa/i, score: 70 },
  { re: /faq|perguntas|duvidas/i, score: 60 },
  { re: /blog|noticia|article/i, score: 20 },
];

export function scorePath(pathname: string): number {
  let score = 10;
  for (const pattern of PRIORITY_PATTERNS) {
    if (pattern.re.test(pathname)) {
      score = Math.max(score, pattern.score);
    }
  }
  // Prefer shorter paths
  score -= Math.min(pathname.split("/").filter(Boolean).length, 5);
  return score;
}

export function prioritizeUrls(urls: string[]): string[] {
  return [...urls].sort((a, b) => {
    const pathA = safePath(a);
    const pathB = safePath(b);
    const diff = scorePath(pathB) - scorePath(pathA);
    if (diff !== 0) return diff;
    return pathA.localeCompare(pathB);
  });
}

function safePath(href: string): string {
  try {
    return new URL(href).pathname || "/";
  } catch {
    return "/";
  }
}

export function collectInternalLinks(options: {
  hrefs: string[];
  baseUrl: string;
  allowedOrigin: string;
  alreadySeen: Set<string>;
}): string[] {
  const out: string[] = [];
  for (const href of options.hrefs) {
    if (!href || isSkippableHref(href)) continue;
    const normalized = normalizeCrawlUrl(href, options.baseUrl);
    if (!normalized) continue;
    if (!isSameOrigin(normalized, options.allowedOrigin)) continue;
    const path = safePath(normalized);
    if (shouldSkipPath(path)) continue;
    if (options.alreadySeen.has(normalized)) continue;
    options.alreadySeen.add(normalized);
    out.push(normalized);
  }
  return prioritizeUrls(out);
}

export function mergeSitemapHints(
  sitemapUrls: string[],
  allowedOrigin: string,
  alreadySeen: Set<string>,
): string[] {
  const accepted: string[] = [];
  for (const raw of sitemapUrls) {
    if (isSkippableHref(raw)) continue;
    const normalized = normalizeCrawlUrl(raw, allowedOrigin);
    if (!normalized) continue;
    if (!isSameOrigin(normalized, allowedOrigin)) continue;
    if (shouldSkipPath(safePath(normalized))) continue;
    if (alreadySeen.has(normalized)) continue;
    alreadySeen.add(normalized);
    accepted.push(normalized);
  }
  return prioritizeUrls(accepted);
}
