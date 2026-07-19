import type { CrawlErrorCode } from "./errors";
import { safeErrorMessage } from "./errors";
import {
  CRAWLER_ACCEPT,
  CRAWLER_USER_AGENT,
  DEFAULT_REQUEST_TIMEOUT_MS,
  HARD_MAX_REDIRECTS,
  HARD_MAX_RESPONSE_BYTES,
  type FetchedPage,
} from "./types";
import {
  isSameOrigin,
  resolveAndValidatePublicUrl,
  type LookupFn,
} from "./url-policy";

export type FetchPageResult =
  | { ok: true; page: FetchedPage }
  | { ok: false; code: CrawlErrorCode; message: string; statusCode?: number };

function isHtmlContentType(contentType: string | null): boolean {
  if (!contentType) return true; // allow missing CT; validate by sniff lightly later
  const ct = contentType.toLowerCase().split(";")[0]?.trim() ?? "";
  return (
    ct === "text/html" ||
    ct === "application/xhtml+xml" ||
    ct === "text/plain"
  );
}

async function readBodyWithLimit(
  response: Response,
  maxBytes: number,
): Promise<{ ok: true; text: string } | { ok: false; code: CrawlErrorCode }> {
  const reader = response.body?.getReader();
  if (!reader) {
    const text = await response.text();
    if (Buffer.byteLength(text, "utf8") > maxBytes) {
      return { ok: false, code: "response_too_large" };
    }
    return { ok: true, text };
  }

  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      total += value.byteLength;
      if (total > maxBytes) {
        try {
          await reader.cancel();
        } catch {
          /* ignore */
        }
        return { ok: false, code: "response_too_large" };
      }
      chunks.push(value);
    }
  }

  const merged = Buffer.concat(chunks.map((c) => Buffer.from(c)));
  return { ok: true, text: merged.toString("utf8") };
}

export async function fetchHtmlPage(options: {
  url: string;
  allowedOrigin: string;
  fetchImpl?: typeof fetch;
  lookupImpl?: LookupFn;
  timeoutMs?: number;
  maxRedirects?: number;
  maxBytes?: number;
}): Promise<FetchPageResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
  const maxRedirects = options.maxRedirects ?? HARD_MAX_REDIRECTS;
  const maxBytes = options.maxBytes ?? HARD_MAX_RESPONSE_BYTES;

  let currentUrl = options.url;
  const started = Date.now();

  for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount++) {
    if (!isSameOrigin(currentUrl, options.allowedOrigin)) {
      return {
        ok: false,
        code: "redirect_blocked",
        message: safeErrorMessage("redirect_blocked"),
      };
    }

    const validated = await resolveAndValidatePublicUrl(
      currentUrl,
      options.lookupImpl,
    );
    if (!validated.ok) {
      return {
        ok: false,
        code: validated.code,
        message: validated.message,
      };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetchImpl(validated.url.href, {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: {
          "user-agent": CRAWLER_USER_AGENT,
          accept: CRAWLER_ACCEPT,
        },
      });

      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get("location");
        if (!location) {
          return {
            ok: false,
            code: "redirect_blocked",
            message: safeErrorMessage("redirect_blocked"),
          };
        }
        if (redirectCount >= maxRedirects) {
          return {
            ok: false,
            code: "redirect_blocked",
            message: safeErrorMessage("redirect_blocked"),
          };
        }
        currentUrl = new URL(location, validated.url.href).href;
        continue;
      }

      const contentType = response.headers.get("content-type");
      if (!isHtmlContentType(contentType)) {
        return {
          ok: false,
          code: "unsupported_content_type",
          message: safeErrorMessage("unsupported_content_type"),
          statusCode: response.status,
        };
      }

      if (response.status >= 400) {
        return {
          ok: false,
          code: "http_error",
          message: safeErrorMessage("http_error"),
          statusCode: response.status,
        };
      }

      const body = await readBodyWithLimit(response, maxBytes);
      if (!body.ok) {
        return {
          ok: false,
          code: body.code,
          message: safeErrorMessage(body.code),
          statusCode: response.status,
        };
      }

      return {
        ok: true,
        page: {
          finalUrl: validated.url.href,
          statusCode: response.status,
          contentType,
          bodyText: body.text,
          fetchDurationMs: Date.now() - started,
        },
      };
    } catch (error) {
      const name = error instanceof Error ? error.name : "";
      if (name === "AbortError") {
        return {
          ok: false,
          code: "timeout",
          message: safeErrorMessage("timeout"),
        };
      }
      return {
        ok: false,
        code: "unexpected_error",
        message: safeErrorMessage("unexpected_error"),
      };
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    ok: false,
    code: "redirect_blocked",
    message: safeErrorMessage("redirect_blocked"),
  };
}
