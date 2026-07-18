"use client";

import { useEffect, useId, useRef } from "react";

type TurnstileFieldProps = {
  siteKey: string;
  onTokenChange: (token: string | null) => void;
  onError?: () => void;
};

declare global {
  interface Window {
    turnstile?: {
      render: (
        element: HTMLElement,
        options: {
          sitekey: string;
          callback: (token: string) => void;
          "expired-callback"?: () => void;
          "error-callback"?: () => void;
          theme?: "light" | "dark" | "auto";
          size?: "normal" | "compact" | "flexible";
        },
      ) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId?: string) => void;
    };
    __atriaTurnstileScriptPromise?: Promise<void>;
  }
}

function loadTurnstileScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.turnstile) return Promise.resolve();
  if (window.__atriaTurnstileScriptPromise) {
    return window.__atriaTurnstileScriptPromise;
  }

  window.__atriaTurnstileScriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-atria-turnstile="true"]',
    );
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.dataset.atriaTurnstile = "true";
    script.onload = () => resolve();
    script.onerror = () => reject();
    document.head.appendChild(script);
  });

  return window.__atriaTurnstileScriptPromise;
}

export function TurnstileField({
  siteKey,
  onTokenChange,
  onError,
}: TurnstileFieldProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const labelId = useId();

  useEffect(() => {
    let cancelled = false;

    async function mount() {
      try {
        await loadTurnstileScript();
        if (cancelled || !containerRef.current || !window.turnstile) return;

        if (widgetIdRef.current) {
          window.turnstile.remove(widgetIdRef.current);
          widgetIdRef.current = null;
        }

        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          theme: "dark",
          size: "flexible",
          callback: (token) => onTokenChange(token),
          "expired-callback": () => onTokenChange(null),
          "error-callback": () => {
            onTokenChange(null);
            onError?.();
          },
        });
      } catch {
        onTokenChange(null);
        onError?.();
      }
    }

    void mount();

    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [siteKey, onTokenChange, onError]);

  return (
    <div className="turnstile-field">
      <p id={labelId} className="turnstile-field__label">
        Verificação antiabuso
      </p>
      <div
        ref={containerRef}
        className="turnstile-field__widget"
        aria-labelledby={labelId}
      />
    </div>
  );
}
