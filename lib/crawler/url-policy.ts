import { lookup as dnsLookup } from "node:dns/promises";
import { isIP } from "node:net";
import type { CrawlErrorCode } from "./errors";
import type { ValidatedPublicUrl } from "./types";

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
