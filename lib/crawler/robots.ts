import {
  CRAWLER_USER_AGENT,
  DEFAULT_REQUEST_TIMEOUT_MS,
} from "./types";
import { isSameOrigin, resolveAndValidatePublicUrl } from "./url-policy";

export type RobotsPolicy = {
  available: boolean;
  crawlDelayMs: number | null;
  sitemaps: string[];
  /** When robots.txt cannot be fetched, use conservative allow-home-only. */
  conservativeFallback: boolean;
  isPathAllowed: (pathname: string) => boolean;
};

type RobotsGroup = {
  agents: string[];
  allows: string[];
  disallows: string[];
  crawlDelay: number | null;
};

function matchesRule(pathname: string, rule: string): boolean {
  if (rule === "") return false;
  if (rule === "/") return true;
  // Basic prefix match (robots.txt wildcards limited MVP)
  const pattern = rule.replace(/\*/g, ".*").replace(/\?/g, "\\?");
  try {
    return new RegExp(`^${pattern}`).test(pathname);
  } catch {
    return pathname.startsWith(rule);
  }
}

function isAllowedByRules(
  pathname: string,
  allows: string[],
  disallows: string[],
): boolean {
  let bestAllow = -1;
  let bestDisallow = -1;
  for (const rule of allows) {
    if (matchesRule(pathname, rule)) {
      bestAllow = Math.max(bestAllow, rule.length);
    }
  }
  for (const rule of disallows) {
    if (matchesRule(pathname, rule)) {
      bestDisallow = Math.max(bestDisallow, rule.length);
    }
  }
  if (bestDisallow < 0 && bestAllow < 0) return true;
  if (bestAllow >= bestDisallow) return true;
  return false;
}

export function parseRobotsTxt(body: string, userAgent: string): RobotsPolicy {
  const lines = body.split(/\r?\n/);
  const groups: RobotsGroup[] = [];
  let current: RobotsGroup | null = null;
  const sitemaps: string[] = [];

  for (const rawLine of lines) {
    const line = rawLine.replace(/#.*$/, "").trim();
    if (!line) continue;
    const idx = line.indexOf(":");
    if (idx < 0) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();

    if (key === "user-agent") {
      if (!current || current.allows.length || current.disallows.length) {
        current = {
          agents: [value.toLowerCase()],
          allows: [],
          disallows: [],
          crawlDelay: null,
        };
        groups.push(current);
      } else {
        current.agents.push(value.toLowerCase());
      }
      continue;
    }

    if (!current) continue;

    if (key === "allow") current.allows.push(value);
    else if (key === "disallow") current.disallows.push(value);
    else if (key === "crawl-delay") {
      const seconds = Number(value);
      if (Number.isFinite(seconds) && seconds >= 0) {
        current.crawlDelay = Math.min(seconds * 1000, 10_000);
      }
    } else if (key === "sitemap") {
      sitemaps.push(value);
    }
  }

  const ua = userAgent.toLowerCase();
  const specific =
    groups.find((g) => g.agents.some((a) => a !== "*" && ua.includes(a))) ??
    groups.find((g) => g.agents.includes("*")) ??
    null;

  const allows = specific?.allows ?? [];
  const disallows = specific?.disallows ?? [];
  const crawlDelayMs = specific?.crawlDelay ?? null;

  return {
    available: true,
    crawlDelayMs,
    sitemaps,
    conservativeFallback: false,
    isPathAllowed: (pathname) => isAllowedByRules(pathname, allows, disallows),
  };
}

export function conservativeRobotsPolicy(): RobotsPolicy {
  return {
    available: false,
    crawlDelayMs: 1000,
    sitemaps: [],
    conservativeFallback: true,
    // Only allow the site root when robots.txt is unavailable.
    isPathAllowed: (pathname) => pathname === "/" || pathname === "",
  };
}

export async function loadRobotsPolicy(options: {
  origin: string;
  fetchImpl?: typeof fetch;
  lookupImpl?: Parameters<typeof resolveAndValidatePublicUrl>[1];
}): Promise<RobotsPolicy> {
  const robotsUrl = new URL("/robots.txt", options.origin).href;
  const validated = await resolveAndValidatePublicUrl(
    robotsUrl,
    options.lookupImpl,
  );
  if (!validated.ok) {
    return conservativeRobotsPolicy();
  }

  const fetchImpl = options.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    DEFAULT_REQUEST_TIMEOUT_MS,
  );

  try {
    const response = await fetchImpl(validated.url.href, {
      method: "GET",
      redirect: "manual",
      signal: controller.signal,
      headers: {
        "user-agent": CRAWLER_USER_AGENT,
        accept: "text/plain,*/*;q=0.1",
      },
    });

    // Follow at most one same-origin redirect for robots.txt
    let final = response;
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      if (!location) return conservativeRobotsPolicy();
      const next = new URL(location, validated.url.href).href;
      if (!isSameOrigin(next, options.origin)) {
        return conservativeRobotsPolicy();
      }
      const nextValidated = await resolveAndValidatePublicUrl(
        next,
        options.lookupImpl,
      );
      if (!nextValidated.ok) return conservativeRobotsPolicy();
      final = await fetchImpl(nextValidated.url.href, {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: {
          "user-agent": CRAWLER_USER_AGENT,
          accept: "text/plain,*/*;q=0.1",
        },
      });
    }

    if (final.status === 404) {
      // Missing robots.txt → allow-all is common practice; we still crawl
      // conservatively with delay but allow paths (documented).
      return {
        available: false,
        crawlDelayMs: 250,
        sitemaps: [],
        conservativeFallback: false,
        isPathAllowed: () => true,
      };
    }

    if (!final.ok) return conservativeRobotsPolicy();

    const contentType = final.headers.get("content-type") ?? "";
    if (
      contentType &&
      !/text\/plain|text\/html|application\/octet-stream/i.test(contentType)
    ) {
      return conservativeRobotsPolicy();
    }

    const body = await final.text();
    if (body.length > 512_000) return conservativeRobotsPolicy();
    return parseRobotsTxt(body, CRAWLER_USER_AGENT);
  } catch {
    return conservativeRobotsPolicy();
  } finally {
    clearTimeout(timer);
  }
}
