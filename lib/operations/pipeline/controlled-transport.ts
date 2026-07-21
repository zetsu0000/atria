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
 *
 * `approvedRealCrawlHostnames` extends that default allowlist, per
 * invocation only, for a manually-approved, explicitly-listed domain (e.g.
 * a single-clinic rehearsal against that clinic's real site). It is never
 * persisted anywhere — the caller (a CLI flag) must pass it explicitly on
 * every run — and it never accepts wildcards (see isValidApprovedDomainEntry).
 * Approving a hostname only clears the hostname-allowlist gate; it has no
 * effect on the fully independent SSRF/private-IP guard in
 * lib/crawler/url-policy.ts (blocked hostnames like "localhost", and any
 * resolved private/loopback/link-local/metadata IP address, are refused
 * regardless of hostname approval — see the "private/localhost" tests in
 * lib/operations/controlled-automation-pipeline.test.ts), and no effect on
 * the target-guard's production refusal (lib/operations/pipeline/target-guard.ts),
 * which is a fully separate gate.
 */
import { lookup as dnsLookup } from "node:dns/promises";
import { isIP } from "node:net";
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

/**
 * Hygiene check for a single `--approved-domains` CLI entry: must be a
 * plain hostname (no protocol, path, port, credentials, or whitespace), no
 * wildcard character, and not a raw IP literal (approval is for domains,
 * not addresses — IP-level safety is the independent SSRF guard's job).
 * This is a CLI-input shape check, not the security boundary itself — even
 * an entry that somehow bypasses it (e.g. a lower-level caller passing
 * `approvedRealCrawlHostnames` directly) still cannot defeat the SSRF/
 * private-IP guard, which is evaluated on the resolved address regardless
 * of hostname approval.
 */
export function isValidApprovedDomainEntry(entry: string): boolean {
  const trimmed = entry.trim().toLowerCase();
  if (!trimmed) return false;
  if (trimmed.includes("*")) return false;
  if (/[\s/:@]/.test(trimmed)) return false;
  if (trimmed.startsWith(".") || trimmed.endsWith(".") || trimmed.includes("..")) return false;
  if (isIP(trimmed)) return false;
  return /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/.test(trimmed);
}

export type ControlledTransportOptions = {
  allowRealCrawl: boolean;
  /** Optional per-URL fixture HTML; falls back to DEFAULT_FIXTURE_HTML. */
  fixtureHtmlByUrl?: Record<string, string>;
  /** Full override of the allowed-hosts list; overridable for tests. Takes precedence over approvedRealCrawlHostnames. */
  allowedRealCrawlHostnames?: readonly string[];
  /**
   * Explicit, per-invocation additions to ALLOWED_REAL_CRAWL_HOSTNAMES —
   * the manual-approval mechanism. Validate each entry with
   * isValidApprovedDomainEntry before use (the CLI layer does this).
   * Ignored when allowedRealCrawlHostnames is also set.
   */
  approvedRealCrawlHostnames?: readonly string[];
  /** Overridable for tests — defaults to a real node:dns lookup. Only ever consulted when allowRealCrawl is true AND the hostname already passed the allowlist gate. */
  realLookupImpl?: LookupFn;
};

export function resolveAllowedRealCrawlHostnames(options: ControlledTransportOptions): readonly string[] {
  if (options.allowedRealCrawlHostnames) return options.allowedRealCrawlHostnames;
  const approved = options.approvedRealCrawlHostnames ?? [];
  return approved.length ? [...ALLOWED_REAL_CRAWL_HOSTNAMES, ...approved] : ALLOWED_REAL_CRAWL_HOSTNAMES;
}

export function createControlledFetchHtmlPage(
  options: ControlledTransportOptions,
): RunCrawlJobDeps["fetchHtmlPage"] {
  const allowedHosts = resolveAllowedRealCrawlHostnames(options);

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
  const allowedHosts = resolveAllowedRealCrawlHostnames(options);

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

async function defaultRealLookup(hostname: string): ReturnType<LookupFn> {
  const result = await dnsLookup(hostname, { all: true, verbatim: true });
  return result.map((r) => ({ address: r.address, family: r.family }));
}

/**
 * Controlled DNS lookup for `resolveAndValidatePublicUrl` (called by
 * `runCrawlJob` before any fetch, independent of `fetchHtmlPage`). Without
 * this, fixture-mode URL validation would still perform a real DNS lookup
 * and fail for synthetic fixture hostnames that don't actually resolve —
 * breaking the "no network at all" guarantee of the default mode.
 *
 * Note: `resolveAndValidatePublicUrl` also independently rejects blocked
 * hostnames (e.g. "localhost") and blocked/private resolved IP addresses
 * *before and after* this lookup runs — approving a hostname here only
 * clears this allowlist gate, never the SSRF/private-IP guard.
 */
export function createControlledLookup(options: ControlledTransportOptions): LookupFn {
  const allowedHosts = resolveAllowedRealCrawlHostnames(options);
  const realLookup = options.realLookupImpl ?? defaultRealLookup;

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
    return realLookup(hostname);
  };
}
