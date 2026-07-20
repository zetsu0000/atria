"use client";

import {
  type AnchorHTMLAttributes,
  type MouseEvent,
  type ReactNode,
} from "react";

interface RequestPreviewLinkProps
  extends AnchorHTMLAttributes<HTMLAnchorElement> {
  children: ReactNode;
}

function scrollToRequestForm() {
  const target = document.querySelector<HTMLElement>("#solicitar");
  const heading = document.querySelector<HTMLElement>("#request-title");
  if (!target || !heading) return;

  // Menu close may leave body overflow locked for a frame; clear before scroll.
  if (document.body.style.overflow === "hidden") {
    document.body.style.overflow = "";
  }

  const reduceMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;

  target.scrollIntoView({
    behavior: reduceMotion ? "auto" : "smooth",
    block: "start",
  });
  window.history.replaceState(null, "", "#solicitar");

  if (reduceMotion) {
    heading.focus({ preventScroll: true });
    return;
  }

  window.setTimeout(() => heading.focus({ preventScroll: true }), 450);
}

export function RequestPreviewLink({
  children,
  onClick,
  ...props
}: RequestPreviewLinkProps) {
  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    onClick?.(event);
    if (event.defaultPrevented) return;

    const target = document.querySelector<HTMLElement>("#solicitar");
    const heading = document.querySelector<HTMLElement>("#request-title");
    if (!target || !heading) return;

    event.preventDefault();

    // Defer so menu close can drop inert/overflow before scrolling main.
    window.requestAnimationFrame(() => {
      window.setTimeout(scrollToRequestForm, 50);
    });
  }

  return (
    <a {...props} href="#solicitar" onClick={handleClick}>
      {children}
    </a>
  );
}
