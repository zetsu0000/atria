import { lookup as dnsLookup } from "node:dns/promises";
import { isIP } from "node:net";
import type { CrawlErrorCode } from "./errors";
import { CRAWLER_ACCEPT, CRAWLER_USER_AGENT, type ValidatedPublicUrl } from "./types";

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "metadata.google.internal",
  "metadata",
  "metadata.aws.internal",
]);

const BLOCKED_HOSTNAME_SUFFIXES = [".local", ".localhost", ".internal", ".intranet"];

/** Ports allowed for public clinic sites. */
const ALLOWED_PORTS = new Set(["", "80", "443"]);

export type UrlPolicyFailure = {
  ok: false;
  code: CrawlErrorCode;
  message: string;
};

export type UrlPolicySuccess = {
  ok: true;
  url: ValidatedPublicUrl;
  resolvedAddresses: string[];
};

export type UrlPolicyResult = UrlPolicySuccess | UrlPolicyFailure;

function normalizeHostname(hostname: string): string {
  return hostname.trim().toLowerCase().replace(/\.$/, "");
}

function isBlockedHostname(hostname: string): boolean {
  if (!hostname) return true;
  if (BLOCKED_HOSTNAMES.has(hostname)) return true;
  if (hostname.endsWith(".local")) return true;
  for (const suffix of BLOCKED_HOSTNAME_SUFFIXES) {
    if (hostname.endsWith(suffix)) return true;
  }
  return false;
}

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let n = 0;
  for (const part of parts) {
    if (!/^\d+$/.test(part)) return null;
    const v = Number(part);
    if (v < 0 || v > 255) return null;
    n = (n << 8) + v;
  }
  return n >>> 0;
}

function inCidr(ipInt: number, base: string, prefix: number): boolean {
  const baseInt = ipv4ToInt(base);
  if (baseInt == null) return false;
  const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
  return (ipInt & mask) === (baseInt & mask);
}

export function isBlockedIpv4(ip: string): boolean {
  const n = ipv4ToInt(ip);
  if (n == null) return true;

  // 0.0.0.0/8, 127.0.0.0/8, 10/8, 172.16/12, 192.168/16, 169.254/16
  // 100.64/10 (CGNAT), 192.0.0.0/24, 192.0.2.0/24, 198.18/15, 198.51.100/24,
  // 203.0.113/24, 224/4 multicast, 240/4 reserved, broadcast
  if (inCidr(n, "0.0.0.0", 8)) return true;
  if (inCidr(n, "127.0.0.0", 8)) return true;
  if (inCidr(n, "10.0.0.0", 8)) return true;
  if (inCidr(n, "172.16.0.0", 12)) return true;
  if (inCidr(n, "192.168.0.0", 16)) return true;
  if (inCidr(n, "169.254.0.0", 16)) return true;
  if (inCidr(n, "100.64.0.0", 10)) return true;
  if (inCidr(n, "192.0.0.0", 24)) return true;
  if (inCidr(n, "192.0.2.0", 24)) return true;
  if (inCidr(n, "198.18.0.0", 15)) return true;
  if (inCidr(n, "198.51.100.0", 24)) return true;
  if (inCidr(n, "203.0.113.0", 24)) return true;
  if (inCidr(n, "224.0.0.0", 4)) return true;
  if (inCidr(n, "240.0.0.0", 4)) return true;
  if (ip === "255.255.255.255") return true;
  // Explicit cloud metadata
  if (ip === "169.254.169.254" || ip === "169.254.170.2") return true;
  return false;
}

export function isBlockedIpv6(ip: string): boolean {
  const normalized = ip.toLowerCase();
  if (normalized === "::" || normalized === "::1") return true;
  if (normalized === "0:0:0:0:0:0:0:0" || normalized === "0:0:0:0:0:0:0:1") {
    return true;
  }

  // IPv4-mapped
  const v4mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (v4mapped) return isBlockedIpv4(v4mapped[1]!);

  // Expand roughly by checking prefixes
  // fc00::/7 unique local, fe80::/10 link-local, ff00::/8 multicast
  const parts = normalized.split(":");
  // Link-local fe80::/10
  if (normalized.startsWith("fe8") || normalized.startsWith("fe9") ||
      normalized.startsWith("fea") || normalized.startsWith("feb")) {
    return true;
  }
  // Unique local fc00::/7
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
  // Multicast
  if (normalized.startsWith("ff")) return true;
  // Documentation / discard
  if (normalized.startsWith("2001:db8")) return true;
  if (parts[0] === "") {
    // compressed forms already handled for ::1
  }
  return false;
}

export function isBlockedIpAddress(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) return isBlockedIpv4(ip);
  if (version === 6) return isBlockedIpv6(ip);
  return true;
}

export function parseAndNormalizePublicUrl(
  raw: string,
): UrlPolicyResult {
  if (typeof raw !== "string" || !raw.trim()) {
    return { ok: false, code: "invalid_url", message: "URL is required." };
  }

  const trimmed = raw.trim();
  if (trimmed.startsWith("//")) {
    return {
      ok: false,
      code: "invalid_url",
      message: "Protocol-relative URLs are not allowed.",
    };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, code: "invalid_url", message: "URL is malformed." };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return {
      ok: false,
      code: "invalid_url",
      message: "Only http and https URLs are allowed.",
    };
  }

  if (parsed.username || parsed.password) {
    return {
      ok: false,
      code: "blocked_host",
      message: "URLs with embedded credentials are not allowed.",
    };
  }

  const hostname = normalizeHostname(parsed.hostname);
  if (!hostname || isBlockedHostname(hostname)) {
    return {
      ok: false,
      code: "blocked_host",
      message: "Hostname is not allowed.",
    };
  }

  // Literal IP host
  if (isIP(hostname) && isBlockedIpAddress(hostname)) {
    return {
      ok: false,
      code: "blocked_host",
      message: "IP address is not allowed.",
    };
  }

  const port = parsed.port;
  if (!ALLOWED_PORTS.has(port)) {
    return {
      ok: false,
      code: "blocked_host",
      message: "Port is not allowed.",
    };
  }

  // Drop fragment; keep path/query as provided for initial URL
  parsed.hash = "";

  const validated: ValidatedPublicUrl = {
    href: parsed.href,
    origin: parsed.origin,
    hostname,
    pathname: parsed.pathname || "/",
    protocol: parsed.protocol as "http:" | "https:",
    port,
  };

  return { ok: true, url: validated, resolvedAddresses: [] };
}

export type LookupFn = (
  hostname: string,
) => Promise<Array<{ address: string; family: number }>>;

export async function resolveAndValidatePublicUrl(
  raw: string,
  lookupImpl: LookupFn = defaultLookup,
): Promise<UrlPolicyResult> {
  const parsed = parseAndNormalizePublicUrl(raw);
  if (!parsed.ok) return parsed;

  // If hostname is already an IP, reuse blocked check
  if (isIP(parsed.url.hostname)) {
    if (isBlockedIpAddress(parsed.url.hostname)) {
      return {
        ok: false,
        code: "blocked_host",
        message: "IP address is not allowed.",
      };
    }
    return { ...parsed, resolvedAddresses: [parsed.url.hostname] };
  }

  let addresses: Array<{ address: string; family: number }>;
  try {
    addresses = await lookupImpl(parsed.url.hostname);
  } catch {
    return {
      ok: false,
      code: "dns_failed",
      message: "DNS resolution failed.",
    };
  }

  if (!addresses.length) {
    return {
      ok: false,
      code: "dns_failed",
      message: "DNS resolution returned no addresses.",
    };
  }

  const resolved: string[] = [];
  for (const entry of addresses) {
    if (isBlockedIpAddress(entry.address)) {
      return {
        ok: false,
        code: "blocked_host",
        message: "Resolved address is not allowed.",
      };
    }
    resolved.push(entry.address);
  }

  return { ...parsed, resolvedAddresses: resolved };
}

async function defaultLookup(
  hostname: string,
): Promise<Array<{ address: string; family: number }>> {
  const result = await dnsLookup(hostname, { all: true, verbatim: true });
  return result.map((r) => ({ address: r.address, family: r.family }));
}

/** Same-origin rule: exact normalized origin match. */
export function isSameOrigin(
  candidateHref: string,
  allowedOrigin: string,
): boolean {
  try {
    const candidate = new URL(candidateHref);
    const allowed = new URL(allowedOrigin);
    return (
      candidate.protocol === allowed.protocol &&
      normalizeHostname(candidate.hostname) ===
        normalizeHostname(allowed.hostname) &&
      (candidate.port || defaultPort(candidate.protocol)) ===
        (allowed.port || defaultPort(allowed.protocol))
    );
  } catch {
    return false;
  }
}

function defaultPort(protocol: string): string {
  return protocol === "https:" ? "443" : "80";
}

export type CanonicalizeHttpUpgradeResult = {
  url: string;
  upgraded: boolean;
  reason: string;
};

/**
 * Safely upgrades a same-host http:// *starting* URL to https:// before a
 * crawl begins, when doing so is verifiably safe. This is never a general
 * redirect-following mechanism, and it never loosens `isSameOrigin` above.
 *
 * Root cause this addresses: `isSameOrigin`'s scheme check is a
 * deliberate, correct SSRF/redirect-safety boundary — a mid-crawl
 * http-to-https redirect really is a different origin by that strict
 * definition, and the bounded crawl loop (lib/crawler/fetch-page.ts) must
 * keep refusing to follow it. But a great many real sites unconditionally
 * redirect every http:// request to https:// on the identical host (a
 * completely standard, safe practice) — so starting the crawl on http://
 * when the site is really only ever served on https:// means the very
 * first request already trips that boundary, and the crawl fails with
 * zero pages fetched before it ever begins. Canonicalizing the *starting*
 * URL once, here, before the bounded crawl loop starts, means the crawl
 * begins already on https:// — `isSameOrigin`'s scheme check is then
 * satisfied naturally, with its strictness completely intact for
 * everything that follows.
 *
 * Upgrades ONLY when every one of the following holds, in order:
 *  1. The input URL's scheme is exactly `http:` (anything else, including
 *     a malformed URL, returns unchanged with `upgraded: false`).
 *  2. The candidate `https://` URL — identical host, identical path/query,
 *     default port only — passes the existing SSRF/private-IP guard
 *     (`resolveAndValidatePublicUrl`), using whatever `lookupImpl` the
 *     caller provides. Callers MUST pass the same host-allowlist-gated
 *     `lookupImpl` used elsewhere in the pipeline (e.g.
 *     `createControlledLookup`'s return value) — that lookup throws for
 *     any non-approved hostname, which `resolveAndValidatePublicUrl`
 *     turns into a normal `dns_failed` guard failure here, so a
 *     non-approved host is refused before any HTTPS network call is ever
 *     made. This function performs no host-allowlist logic of its own.
 *  3. A single, bounded, non-redirect-following preflight request
 *     (`redirect: "manual"`, one attempt, no body read) to that validated
 *     https:// URL succeeds — any 2xx, or a 3xx whose `Location` header
 *     stays on the identical hostname (never followed further). A 3xx to
 *     a *different* host is refused UNLESS that exact target hostname is
 *     listed in `options.additionalApprovedHostnames` (e.g. the very
 *     common `www.` <-> apex-domain canonicalization many real sites
 *     perform alongside their http->https redirect) — and even then, the
 *     cross-host target is independently re-validated through the full
 *     SSRF/private-IP guard (a fresh `resolveAndValidatePublicUrl` call)
 *     before ever being accepted; being on the approved-hostnames list
 *     alone is never sufficient by itself.
 *
 * On any failure of any of the above, the original http:// URL is
 * returned unchanged (`upgraded: false`) and the normal crawl flow
 * proceeds exactly as it did before this function existed — this can
 * never make behavior worse than the pre-fix baseline, only better.
 */
export async function canonicalizeHttpToHttpsIfSafe(
  rawUrl: string,
  options: {
    lookupImpl?: LookupFn;
    fetchImpl?: typeof fetch;
    timeoutMs?: number;
    /**
     * Hostnames explicitly approved as a preflight redirect target, even
     * when they differ from the input URL's own host — the real-crawl
     * domain allowlist (`ALLOWED_REAL_CRAWL_HOSTNAMES` +
     * `--approved-domains`, see controlled-transport.ts). Suffix-matched
     * the same way as that allowlist (exact match or `.`-suffix match);
     * never wildcards. A redirect to any other host is always refused.
     */
    additionalApprovedHostnames?: readonly string[];
  } = {},
): Promise<CanonicalizeHttpUpgradeResult> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { url: rawUrl, upgraded: false, reason: "invalid_url" };
  }
  if (parsed.protocol !== "http:") {
    return { url: rawUrl, upgraded: false, reason: "not_http" };
  }

  const httpsUrl = new URL(rawUrl);
  httpsUrl.protocol = "https:";
  if (httpsUrl.port === "80") httpsUrl.port = "";

  const validated = await resolveAndValidatePublicUrl(httpsUrl.href, options.lookupImpl);
  if (!validated.ok) {
    return { url: rawUrl, upgraded: false, reason: `ssrf_guard_failed:${validated.code}` };
  }

  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? 5000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(validated.url.href, {
      method: "GET",
      redirect: "manual",
      signal: controller.signal,
      headers: { "user-agent": CRAWLER_USER_AGENT, accept: CRAWLER_ACCEPT },
    });

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      if (!location) {
        return { url: rawUrl, upgraded: false, reason: "https_preflight_redirect_no_location" };
      }
      let target: URL;
      try {
        target = new URL(location, validated.url.href);
      } catch {
        return { url: rawUrl, upgraded: false, reason: "https_preflight_redirect_invalid" };
      }
      if (normalizeHostname(target.hostname) !== normalizeHostname(parsed.hostname)) {
        const targetHost = normalizeHostname(target.hostname);
        const isExplicitlyApproved = (options.additionalApprovedHostnames ?? []).some((entry) => {
          const approved = normalizeHostname(entry);
          return targetHost === approved || targetHost.endsWith(`.${approved}`);
        });
        if (!isExplicitlyApproved) {
          return { url: rawUrl, upgraded: false, reason: "https_preflight_redirect_cross_host" };
        }
        const crossHostValidated = await resolveAndValidatePublicUrl(target.href, options.lookupImpl);
        if (!crossHostValidated.ok) {
          return { url: rawUrl, upgraded: false, reason: `ssrf_guard_failed_cross_host:${crossHostValidated.code}` };
        }
        return { url: crossHostValidated.url.href, upgraded: true, reason: "http_to_https_cross_host_redirect_approved" };
      }
      return { url: target.href, upgraded: true, reason: "http_to_https_same_host_redirect" };
    }

    if (response.status >= 200 && response.status < 400) {
      return { url: validated.url.href, upgraded: true, reason: "http_to_https_preflight_ok" };
    }

    return { url: rawUrl, upgraded: false, reason: `https_preflight_status_${response.status}` };
  } catch {
    return { url: rawUrl, upgraded: false, reason: "https_preflight_failed" };
  } finally {
    clearTimeout(timer);
  }
}

const TRACKING_PARAMS = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "gclid",
  "fbclid",
  "mc_cid",
  "mc_eid",
]);

export function normalizeCrawlUrl(
  raw: string,
  baseHref: string,
): string | null {
  let url: URL;
  try {
    url = new URL(raw, baseHref);
  } catch {
    return null;
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (url.username || url.password) return null;

  url.hash = "";

  // Drop common tracking params
  const keys = [...url.searchParams.keys()];
  for (const key of keys) {
    if (TRACKING_PARAMS.has(key.toLowerCase())) {
      url.searchParams.delete(key);
    }
  }

  // Normalize pathname empty
  if (!url.pathname) url.pathname = "/";

  // Sort remaining params for stable dedupe
  url.searchParams.sort();

  return url.href;
}

export function shouldSkipPath(pathname: string): boolean {
  const path = pathname.toLowerCase();
  if (
    path.includes("/logout") ||
    path.includes("/log-out") ||
    path.includes("/login") ||
    path.includes("/signin") ||
    path.includes("/sign-in") ||
    path.includes("/admin") ||
    path.includes("/wp-admin") ||
    path.includes("/wp-login") ||
    path.includes("/cart") ||
    path.includes("/checkout") ||
    path.includes("/search") ||
    path.includes("/cdn-cgi/") ||
    path.includes("/agendamento") ||
    path.includes("/agendar") ||
    path.includes("/marcacao") ||
    path.includes("/marcação") ||
    path.includes("/portal") ||
    path.includes("/paciente") ||
    path.includes("/patient") ||
    path.includes("/prontuario") ||
    path.includes("/prontuário") ||
    path.includes("/minha-conta") ||
    path.includes("/account") ||
    path.includes("/dashboard")
  ) {
    return true;
  }

  // File extensions that are not HTML pages
  if (
    /\.(jpg|jpeg|png|gif|webp|svg|ico|bmp|mp4|webm|mp3|wav|pdf|zip|gz|rar|7z|exe|dmg|apk|woff2?|ttf|otf|css|js|mjs|map|json|xml|rss|atom)(\?|$)/i.test(
      path,
    )
  ) {
    return true;
  }

  return false;
}

export function isSkippableHref(href: string): boolean {
  const lower = href.trim().toLowerCase();
  if (
    lower.startsWith("mailto:") ||
    lower.startsWith("tel:") ||
    lower.startsWith("sms:") ||
    lower.startsWith("whatsapp:") ||
    lower.startsWith("javascript:") ||
    lower.startsWith("data:") ||
    lower.startsWith("blob:") ||
    lower.startsWith("file:") ||
    lower.startsWith("ftp:")
  ) {
    return true;
  }
  return false;
}
