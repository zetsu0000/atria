import { parse as parseHtml } from "node-html-parser";
import { createHash } from "node:crypto";
import { HARD_MAX_MAIN_TEXT_CHARS, type ParsedPageContent } from "./types";
import {
  isSameOrigin,
  isSkippableHref,
  normalizeCrawlUrl,
  shouldSkipPath,
} from "./url-policy";

const REMOVE_TAGS = [
  "script",
  "style",
  "noscript",
  "svg",
  "iframe",
  "object",
  "embed",
  "template",
  "link",
];

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function metaContent(
  root: ReturnType<typeof parseHtml>,
  name: string,
): string | null {
  const el =
    root.querySelector(`meta[name="${name}"]`) ??
    root.querySelector(`meta[property="${name}"]`) ??
    root.querySelector(`meta[name="${name.toLowerCase()}"]`);
  const content = el?.getAttribute("content");
  if (!content) return null;
  const collapsed = collapseWhitespace(content);
  return collapsed ? collapsed.slice(0, 1000) : null;
}

export function parseHtmlPage(
  html: string,
  pageUrl: string,
  allowedOrigin: string,
): ParsedPageContent {
  const root = parseHtml(html, {
    comment: false,
    blockTextElements: {
      script: true,
      style: true,
      noscript: true,
    },
  });

  // Extract head metadata before stripping non-content tags.
  const title = collapseWhitespace(root.querySelector("title")?.text ?? "").slice(
    0,
    500,
  ) || null;

  const metaDescription =
    metaContent(root, "description") ?? metaContent(root, "og:description");

  const canonicalHref =
    root.querySelector('link[rel="canonical"]')?.getAttribute("href") ?? null;
  let canonicalUrl: string | null = null;
  if (canonicalHref) {
    const normalized = normalizeCrawlUrl(canonicalHref, pageUrl);
    if (normalized && isSameOrigin(normalized, allowedOrigin)) {
      canonicalUrl = normalized;
    }
  }

  const language =
    root.querySelector("html")?.getAttribute("lang")?.trim().slice(0, 32) ||
    null;

  for (const tag of REMOVE_TAGS) {
    for (const node of root.querySelectorAll(tag)) {
      node.remove();
    }
  }

  // Strip inline event handlers from remaining elements
  for (const el of root.querySelectorAll("*")) {
    for (const attr of Object.keys(el.attributes ?? {})) {
      if (/^on/i.test(attr)) {
        el.removeAttribute(attr);
      }
    }
  }

  const headings: string[] = [];
  for (const heading of root.querySelectorAll("h1, h2, h3")) {
    const text = collapseWhitespace(heading.text);
    if (text) headings.push(text.slice(0, 300));
    if (headings.length >= 40) break;
  }

  // Prefer main/article; fallback to body
  const mainNode =
    root.querySelector("main") ??
    root.querySelector("article") ??
    root.querySelector("body") ??
    root;

  // Drop common chrome
  for (const sel of ["nav", "header", "footer", "aside"]) {
    for (const node of mainNode.querySelectorAll(sel)) {
      node.remove();
    }
  }

  let mainText = collapseWhitespace(mainNode.text);
  if (mainText.length > HARD_MAX_MAIN_TEXT_CHARS) {
    mainText = mainText.slice(0, HARD_MAX_MAIN_TEXT_CHARS);
  }

  const linksInternal: string[] = [];
  const seen = new Set<string>();
  for (const anchor of root.querySelectorAll("a[href]")) {
    const href = anchor.getAttribute("href");
    if (!href || isSkippableHref(href)) continue;
    const normalized = normalizeCrawlUrl(href, pageUrl);
    if (!normalized) continue;
    if (!isSameOrigin(normalized, allowedOrigin)) continue;
    let path: string;
    try {
      path = new URL(normalized).pathname;
    } catch {
      continue;
    }
    if (shouldSkipPath(path)) continue;
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    linksInternal.push(normalized);
    if (linksInternal.length >= 200) break;
  }

  return {
    title,
    metaDescription,
    canonicalUrl,
    headings,
    mainText: mainText || null,
    linksInternal,
    language,
  };
}

export function hashPageContent(mainText: string | null, title: string | null): string {
  return createHash("sha256")
    .update(title ?? "")
    .update("\n")
    .update(mainText ?? "")
    .digest("hex");
}
