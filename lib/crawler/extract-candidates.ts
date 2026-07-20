import { parse as parseHtml } from "node-html-parser";
import type {
  ExtractionCandidate,
  PageExtractionInput,
} from "./extraction-types";

const EMAIL_RE =
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE_RE =
  /(?:\+?55\s?)?(?:\(?\d{2}\)?\s?)?(?:9?\d{4}[-.\s]?\d{4})/g;
const WHATSAPP_HOST_RE = /(?:api\.)?whatsapp\.com|wa\.me/i;

function candidate(
  partial: Omit<ExtractionCandidate, "reviewStatus">,
): ExtractionCandidate {
  return { ...partial, reviewStatus: "pending_review" };
}

function collapse(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function uniquePush(
  list: ExtractionCandidate[],
  seen: Set<string>,
  item: ExtractionCandidate,
): void {
  const key = `${item.kind}|${item.value.toLowerCase()}|${item.sourceUrl}`;
  if (seen.has(key)) return;
  seen.add(key);
  list.push(item);
}

/**
 * Extract public website candidates with provenance.
 * Does not invent CRM/RQE/credentials. Does not call AI.
 */
export function extractPageCandidates(
  input: PageExtractionInput,
): ExtractionCandidate[] {
  const out: ExtractionCandidate[] = [];
  const seen = new Set<string>();
  const page = input.pageUrl;

  if (input.title) {
    uniquePush(
      out,
      seen,
      candidate({
        kind: "title",
        value: input.title,
        sourceUrl: page,
        sourcePage: page,
        extractionMethod: "meta",
        confidence: "high",
      }),
    );
  }

  if (input.metaDescription) {
    uniquePush(
      out,
      seen,
      candidate({
        kind: "meta_description",
        value: input.metaDescription,
        sourceUrl: page,
        sourcePage: page,
        extractionMethod: "meta",
        confidence: "high",
      }),
    );
  }

  for (const heading of input.headings) {
    uniquePush(
      out,
      seen,
      candidate({
        kind: "heading",
        value: heading,
        sourceUrl: page,
        sourcePage: page,
        extractionMethod: "heading",
        confidence: "medium",
      }),
    );

    if (/servi[cç]o|tratament|procediment/i.test(heading)) {
      uniquePush(
        out,
        seen,
        candidate({
          kind: "service_candidate",
          value: heading,
          sourceUrl: page,
          sourcePage: page,
          extractionMethod: "heading",
          confidence: "low",
        }),
      );
    }

    if (/dr\.?a? |equipe|corpo cl[ií]nico|m[eé]dic/i.test(heading)) {
      uniquePush(
        out,
        seen,
        candidate({
          kind: "team_name_candidate",
          value: heading,
          sourceUrl: page,
          sourcePage: page,
          extractionMethod: "heading",
          confidence: "low",
        }),
      );
    }
  }

  if (input.mainText) {
    uniquePush(
      out,
      seen,
      candidate({
        kind: "visible_text",
        value: input.mainText.slice(0, 2000),
        sourceUrl: page,
        sourcePage: page,
        extractionMethod: "html_text",
        confidence: "medium",
      }),
    );

    for (const match of input.mainText.match(EMAIL_RE) ?? []) {
      uniquePush(
        out,
        seen,
        candidate({
          kind: "email",
          value: match.toLowerCase(),
          sourceUrl: page,
          sourcePage: page,
          extractionMethod: "html_text",
          confidence: "medium",
        }),
      );
    }

    for (const match of input.mainText.match(PHONE_RE) ?? []) {
      const digits = match.replace(/\D+/g, "");
      if (digits.length < 8) continue;
      uniquePush(
        out,
        seen,
        candidate({
          kind: "phone",
          value: collapse(match),
          sourceUrl: page,
          sourcePage: page,
          extractionMethod: "html_text",
          confidence: "low",
        }),
      );
    }

    if (/\b(rua|av\.|avenida|alameda|cep)\b/i.test(input.mainText)) {
      const snippet = input.mainText.match(
        /(?:rua|av\.|avenida|alameda)[^.]{8,120}/i,
      );
      if (snippet?.[0]) {
        uniquePush(
          out,
          seen,
          candidate({
            kind: "address",
            value: collapse(snippet[0]),
            sourceUrl: page,
            sourcePage: page,
            extractionMethod: "html_text",
            confidence: "low",
          }),
        );
      }
    }
  }

  for (const href of input.linksInternal) {
    uniquePush(
      out,
      seen,
      candidate({
        kind: "page_link",
        value: href,
        sourceUrl: page,
        sourcePage: page,
        extractionMethod: "html_anchor",
        confidence: "high",
      }),
    );
  }

  // Anchor-based phones / mailto / social / whatsapp from raw HTML
  try {
    const root = parseHtml(input.html, { comment: false });
    for (const anchor of root.querySelectorAll("a[href]")) {
      const href = anchor.getAttribute("href")?.trim() ?? "";
      if (!href) continue;
      const lower = href.toLowerCase();

      if (lower.startsWith("mailto:")) {
        const email = lower.replace(/^mailto:/, "").split("?")[0] ?? "";
        if (email.includes("@")) {
          uniquePush(
            out,
            seen,
            candidate({
              kind: "email",
              value: email,
              sourceUrl: page,
              sourcePage: page,
              extractionMethod: "html_anchor",
              confidence: "high",
            }),
          );
        }
      }

      if (lower.startsWith("tel:")) {
        const phone = href.replace(/^tel:/i, "");
        uniquePush(
          out,
          seen,
          candidate({
            kind: "phone",
            value: collapse(phone),
            sourceUrl: page,
            sourcePage: page,
            extractionMethod: "html_anchor",
            confidence: "high",
          }),
        );
      }

      if (WHATSAPP_HOST_RE.test(lower) || lower.startsWith("whatsapp:")) {
        uniquePush(
          out,
          seen,
          candidate({
            kind: "whatsapp",
            value: href,
            sourceUrl: page,
            sourcePage: page,
            extractionMethod: "html_anchor",
            confidence: "high",
          }),
        );
      }

      if (
        /instagram\.com|facebook\.com|linkedin\.com|youtube\.com|tiktok\.com/i.test(
          lower,
        )
      ) {
        uniquePush(
          out,
          seen,
          candidate({
            kind: "social_link",
            value: href,
            sourceUrl: page,
            sourcePage: page,
            extractionMethod: "html_anchor",
            confidence: "medium",
          }),
        );
      }
    }

    for (const img of root.querySelectorAll("img[src]")) {
      const src = img.getAttribute("src");
      if (!src || src.startsWith("data:")) continue;
      const alt = img.getAttribute("alt")?.trim() ?? "";
      uniquePush(
        out,
        seen,
        candidate({
          kind: "image_candidate",
          value: alt ? `${src} (${alt})` : src,
          sourceUrl: page,
          sourcePage: page,
          extractionMethod: "img",
          confidence: "low",
        }),
      );
      if (out.filter((c) => c.kind === "image_candidate").length >= 20) break;
    }
  } catch {
    // Parsing failures must not invent data; skip HTML-specific candidates.
  }

  return out;
}

export function mergeExtractionCandidates(
  batches: ExtractionCandidate[][],
): ExtractionCandidate[] {
  const out: ExtractionCandidate[] = [];
  const seen = new Set<string>();
  for (const batch of batches) {
    for (const item of batch) {
      uniquePush(out, seen, item);
    }
  }
  return out;
}
