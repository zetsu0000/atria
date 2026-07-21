/**
 * Controlled network transport for the automation pipeline.
 *
 * By default (allowRealCrawl = false), every "fetch" is served from an
 * in-memory fixture — no network call is ever made, regardless of which
 * URL is nominally being processed. When allowRealCrawl = true, real
 * network fetches are permitted, but ONLY to an explicit hostname
 * allowlist (default: example.com, the IANA-reserved documentation/testing
 * domain) — this is a hard boundary, not a default, so the pipeline can
 * never reach an arbitrary real clinic website even if a caller passes
 * --allow-real-crawl.
 */
import { lookup as dnsLookup } from "node:dns/promises";
import { fetchHtmlPage as realFetchHtmlPage } from "@/lib/crawler/fetch-page";
import { loadRobotsPolicy as realLoadRobotsPolicy } from "@/lib/crawler/robots";
import type { LookupFn } from "@/lib/crawler/url-policy";
import type { RunCrawlJobDeps } from "@/lib/operations/run-crawl-job";

export const ALLOWED_REAL_CRAWL_HOSTNAMES: readonly string[] = ["example.com", "www.example.com"];

export const DEFAULT_FIXTURE_HTML = `<!doctype html>
<html lang="pt-BR">
  <head>
    <title>Clínica Fixture — Controlled Automation</title>
    <meta name="description" content="Fixture gerada pela automação controlada, sem crawl real.">
  </head>
  <body>
    <main>
      <h1>Clínica Fixture</h1>
      <h2>Serviços</h2>
      <p>Telefone: (11) 90000-0000. E-mail: contato@fixture.example.com</p>
      <a href="/contato">Contato</a>
    </main>
  </body>
</html>`;

export function hostnameOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

export function isAllowedRealCrawlHost(hostname: string, allowedHosts: readonly string[]): boolean {
  return allowedHosts.some((entry) => hostname === entry || hostname.endsWith(`.${entry}`));
}

export type ControlledTransportOptions = {
  allowRealCrawl: boolean;
  /** Optional per-URL fixture HTML; falls back to DEFAULT_FIXTURE_HTML. */
  fixtureHtmlByUrl?: Record<string, string>;
  /** Overridable for tests; defaults to ALLOWED_REAL_CRAWL_HOSTNAMES. */
  allowedRealCrawlHostnames?: readonly string[];
};

export function createControlledFetchHtmlPage(
  options: ControlledTransportOptions,
): RunCrawlJobDeps["fetchHtmlPage"] {
  const allowedHosts = options.allowedRealCrawlHostnames ?? ALLOWED_REAL_CRAWL_HOSTNAMES;

  return async (fetchOptions) => {
    if (!options.allowRealCrawl) {
      const html = options.fixtureHtmlByUrl?.[fetchOptions.url] ?? DEFAULT_FIXTURE_HTML;
      return {
        ok: true,
        page: {
          finalUrl: fetchOptions.url,
          statusCode: 200,
          contentType: "text/html",
          bodyText: html,
          fetchDurationMs: 0,
        },
      };
    }

    const host = hostnameOf(fetchOptions.url);
    if (!host || !isAllowedRealCrawlHost(host, allowedHosts)) {
      return {
        ok: false,
        code: "blocked_host",
        message: `Controlled automation only allows real crawling of: ${allowedHosts.join(", ")}.`,
      };
    }

    return realFetchHtmlPage(fetchOptions);
  };
}

export function createControlledLoadRobotsPolicy(
  options: ControlledTransportOptions,
): RunCrawlJobDeps["loadRobotsPolicy"] {
  const allowedHosts = options.allowedRealCrawlHostnames ?? ALLOWED_REAL_CRAWL_HOSTNAMES;

  return async (robotsOptions) => {
    if (!options.allowRealCrawl) {
      return {
        available: true,
        crawlDelayMs: 0,
        sitemaps: [],
        conservativeFallback: false,
        isPathAllowed: () => true,
      };
    }

    const host = hostnameOf(robotsOptions.origin);
    if (!host || !isAllowedRealCrawlHost(host, allowedHosts)) {
      return {
        available: false,
        crawlDelayMs: 1000,
        sitemaps: [],
        conservativeFallback: true,
        isPathAllowed: (pathname: string) => pathname === "/" || pathname === "",
      };
    }

    return realLoadRobotsPolicy(robotsOptions);
  };
}

/**
 * Controlled DNS lookup for `resolveAndValidatePublicUrl` (called by
 * `runCrawlJob` before any fetch, independent of `fetchHtmlPage`). Without
 * this, fixture-mode URL validation would still perform a real DNS lookup
 * and fail for synthetic fixture hostnames that don't actually resolve —
 * breaking the "no network at all" guarantee of the default mode.
 */
export function createControlledLookup(options: ControlledTransportOptions): LookupFn {
  const allowedHosts = options.allowedRealCrawlHostnames ?? ALLOWED_REAL_CRAWL_HOSTNAMES;

  return async (hostname: string) => {
    if (!options.allowRealCrawl) {
      // Known-safe public address (example.com); never a real DNS call.
      return [{ address: "93.184.216.34", family: 4 }];
    }
    // Even in real-crawl mode, never resolve a non-allowlisted host — the
    // allowlist boundary must hold before any network call, including DNS.
    if (!isAllowedRealCrawlHost(hostname.toLowerCase(), allowedHosts)) {
      throw new Error(`blocked_host: ${hostname} is not in the controlled-automation allowlist`);
    }
    const result = await dnsLookup(hostname, { all: true, verbatim: true });
    return result.map((r) => ({ address: r.address, family: r.family }));
  };
}
