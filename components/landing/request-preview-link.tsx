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

    window.setTimeout(() => heading.focus({ preventScroll: true }), 500);
  }

  return (
    <a {...props} href="#solicitar" onClick={handleClick}>
      {children}
    </a>
  );
}

