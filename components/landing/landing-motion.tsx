"use client";

import { useEffect } from "react";

const MOBILE_QUERY = "(max-width: 37.5rem)";
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
const EASE_OUT = "cubic-bezier(0.16, 1, 0.3, 1)";
const EASE_EDITORIAL = "cubic-bezier(0.65, 0, 0.35, 1)";

type RevealKind = "copy" | "media" | "panel" | "title";

const revealGroups: ReadonlyArray<{
  selector: string;
  kind: RevealKind;
}> = [
  {
    selector: ".opportunity-row, .diagnostic-row, .assurance-row",
    kind: "copy",
  },
  {
    selector: ".comparison-experience, .assurance-index",
    kind: "media",
  },
  {
    selector: ".method-panel",
    kind: "panel",
  },
  {
    selector:
      ".method-heading h2, .comparison-proof__heading h2, .assurance-opening h2, .closing-statement h2, .site-footer__signature",
    kind: "title",
  },
];

function revealFrames(kind: RevealKind): Keyframe[] {
  if (kind === "media") {
    return [
      {
        clipPath: "inset(8% 0 14% 0 round 0.75rem)",
        opacity: 0.55,
        transform: "translateY(2rem) scale(0.965)",
      },
      {
        clipPath: "inset(0 0 0 0 round 0.75rem)",
        opacity: 1,
        transform: "translateY(0) scale(1)",
      },
    ];
  }

  if (kind === "panel") {
    return [
      {
        clipPath: "inset(6% 3% 9% 3% round 1.6rem)",
        opacity: 0.45,
        transform: "translateY(2.25rem) scale(0.94)",
      },
      {
        clipPath: "inset(0 0 0 0 round 1.6rem)",
        opacity: 1,
        transform: "translateY(0) scale(1)",
      },
    ];
  }

  if (kind === "title") {
    return [
      {
        clipPath: "inset(0 0 100% 0)",
        opacity: 0.25,
        transform: "translateY(1.6rem)",
      },
      {
        clipPath: "inset(0 0 0 0)",
        opacity: 1,
        transform: "translateY(0)",
      },
    ];
  }

  return [
    { opacity: 0.35, transform: "translateY(1.4rem)" },
    { opacity: 1, transform: "translateY(0)" },
  ];
}

export function LandingMotion() {
  useEffect(() => {
    const mobile = window.matchMedia(MOBILE_QUERY);
    const reducedMotion = window.matchMedia(REDUCED_MOTION_QUERY);
    const noop = () => {};
    let stopMotion: () => void = noop;

    function startMotion() {
      if (!mobile.matches || reducedMotion.matches) return noop;

      const animations = new Set<Animation>();
      const observers: IntersectionObserver[] = [];
      let frame = 0;

      function play(
        element: Element,
        keyframes: Keyframe[],
        options: KeyframeAnimationOptions,
      ) {
        const animation = element.animate(keyframes, {
          fill: "both",
          ...options,
        });
        animations.add(animation);
        animation.addEventListener(
          "finish",
          () => {
            try {
              animation.commitStyles();
            } catch {
              // The base CSS already represents the final state.
            } finally {
              animation.cancel();
              animations.delete(animation);
            }
          },
          { once: true },
        );
      }

    const revealObserver = new IntersectionObserver(
      (entries, observer) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;

          const element = entry.target as HTMLElement;
          const kind = (element.dataset.revealKind ?? "copy") as RevealKind;
          const order = Number(element.dataset.revealOrder ?? 0);

          play(element, revealFrames(kind), {
            delay: Math.min(order, 4) * 55,
            duration: kind === "copy" ? 680 : 880,
            easing: kind === "media" ? EASE_EDITORIAL : EASE_OUT,
          });
          observer.unobserve(element);
        });
      },
      { rootMargin: "0px 0px -8%", threshold: 0.14 },
    );

    revealGroups.forEach(({ selector, kind }) => {
      document.querySelectorAll<HTMLElement>(selector).forEach((element, index) => {
        element.dataset.revealKind = kind;
        element.dataset.revealOrder = String(index);
        revealObserver.observe(element);
      });
    });
    observers.push(revealObserver);

    const activeMediaObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          (entry.target as HTMLElement).dataset.motionActive = entry.isIntersecting
            ? "true"
            : "false";
        });
      },
      { rootMargin: "12% 0px", threshold: 0.28 },
    );

    document
      .querySelectorAll<HTMLElement>(".method-panel, .media-chapter")
      .forEach((element) => activeMediaObserver.observe(element));
    observers.push(activeMediaObserver);

    const thesis = document.querySelector<HTMLElement>(".thesis-heading h2");
    const words = Array.from(
      document.querySelectorAll<HTMLElement>("[data-motion-word]"),
    );

    function updateWordReveal() {
      frame = 0;
      if (!thesis || !words.length) return;

      const rect = thesis.getBoundingClientRect();
      const travel = Math.max(window.innerHeight * 0.72 + rect.height, 1);
      const rawProgress = (window.innerHeight * 0.84 - rect.top) / travel;
      const progress = Math.min(1, Math.max(0, rawProgress));

      words.forEach((word, index) => {
        const staggered = progress * (words.length + 3) - index;
        word.style.setProperty(
          "--word-progress",
          String(Math.min(1, Math.max(0, staggered))),
        );
      });
    }

    function requestWordReveal() {
      if (!frame) frame = window.requestAnimationFrame(updateWordReveal);
    }

    updateWordReveal();
    window.addEventListener("scroll", requestWordReveal, { passive: true });
    window.addEventListener("resize", requestWordReveal);

      return () => {
        window.cancelAnimationFrame(frame);
        window.removeEventListener("scroll", requestWordReveal);
        window.removeEventListener("resize", requestWordReveal);
        observers.forEach((observer) => observer.disconnect());
        animations.forEach((animation) => animation.cancel());
        document
          .querySelectorAll<HTMLElement>("[data-reveal-kind], [data-motion-active]")
          .forEach((element) => {
            delete element.dataset.revealKind;
            delete element.dataset.revealOrder;
            delete element.dataset.motionActive;
          });
        words.forEach((word) => word.style.removeProperty("--word-progress"));
      };
    }

    function syncMotionPreference() {
      stopMotion();
      stopMotion = startMotion();
    }

    mobile.addEventListener("change", syncMotionPreference);
    reducedMotion.addEventListener("change", syncMotionPreference);
    syncMotionPreference();

    return () => {
      mobile.removeEventListener("change", syncMotionPreference);
      reducedMotion.removeEventListener("change", syncMotionPreference);
      stopMotion();
    };
  }, []);

  return null;
}
