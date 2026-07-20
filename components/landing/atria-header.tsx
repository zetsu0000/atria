"use client";

import { useEffect, useRef, useState } from "react";
import { RequestPreviewLink } from "./request-preview-link";

const navigation = [
  { href: "#visao", label: "Início" },
  { href: "#tese", label: "Por que mudar" },
  { href: "#metodo", label: "Como funciona" },
  { href: "#comparacao", label: "Atual / Proposta" },
  { href: "#seguranca", label: "Segurança" },
] as const;

export function AtriaHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;

    const previousOverflow = document.body.style.overflow;
    const inertTargets = Array.from(
      document.querySelectorAll<HTMLElement>(
        ".wordmark, .header-status, .header-cta, main, footer",
      ),
    ).map((element) => ({ element, wasInert: element.inert }));

    document.body.style.overflow = "hidden";
    inertTargets.forEach(({ element }) => {
      element.inert = true;
    });

    const focusable = () =>
      Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );

    window.requestAnimationFrame(() => focusable()[0]?.focus());

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOpen(false);
        window.requestAnimationFrame(() => toggleRef.current?.focus());
        return;
      }

      if (event.key !== "Tab") return;

      const items = focusable();
      if (!items.length) return;

      const first = items[0];
      const last = items[items.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      inertTargets.forEach(({ element, wasInert }) => {
        element.inert = wasInert;
      });
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  function closeMenu() {
    setMenuOpen(false);
  }

  return (
    <>
      <header className="site-header">
        <button
          ref={toggleRef}
          className="rail-toggle"
          type="button"
          aria-label={menuOpen ? "Fechar menu" : "Abrir menu"}
          aria-haspopup="dialog"
          aria-expanded={menuOpen}
          aria-controls="atria-menu"
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span className="rail-toggle__mark" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
          </span>
          <span className="rail-toggle__label">
            {menuOpen ? "Fechar" : "Menu"}
          </span>
        </button>

        <a className="wordmark" href="#visao" aria-label="Atria, início">
          Atria
        </a>

        <p className="header-status">
          <span aria-hidden="true" />
          Prévia antes da publicação
        </p>

        <RequestPreviewLink className="header-cta">
          <span aria-hidden="true">↗</span>
          Solicitar prévia
        </RequestPreviewLink>
      </header>

      <div className="side-rail" aria-hidden="true">
        <span className="side-rail__line" />
        <span className="side-rail__position" />
      </div>

      {menuOpen && (
        <div
          ref={dialogRef}
          id="atria-menu"
          className="fullscreen-menu"
          role="dialog"
          aria-modal="true"
          aria-label="Menu principal"
        >
          <nav className="menu-primary" aria-label="Navegação da landing">
            <div className="menu-primary__signal" aria-hidden="true">
              <span />
            </div>

            <ul>
              {navigation.map((item, index) => (
                <li key={item.href}>
                  <a href={item.href} onClick={closeMenu}>
                    <span>{item.label}</span>
                    <small>{String(index + 1).padStart(2, "0")}</small>
                  </a>
                </li>
              ))}
            </ul>

            <RequestPreviewLink
              className="menu-request"
              onClick={() => {
                // Close first; RequestPreviewLink defers scroll until after paint.
                closeMenu();
              }}
            >
              Solicitar uma prévia do meu site
            </RequestPreviewLink>
          </nav>

          <a
            className="menu-world menu-world--current"
            href="#comparacao"
            onClick={closeMenu}
          >
            <span className="menu-world__visual" aria-hidden="true" />
            <span>Atual</span>
          </a>
          <a
            className="menu-world menu-world--proposal"
            href="#comparacao"
            onClick={closeMenu}
          >
            <span className="menu-world__visual" aria-hidden="true" />
            <span>Proposta</span>
          </a>
          <a
            className="menu-world menu-world--approved"
            href="#metodo"
            onClick={closeMenu}
          >
            <span className="menu-world__visual" aria-hidden="true" />
            <span>Aprovado</span>
          </a>
          <a
            className="menu-world menu-world--publish"
            href="#seguranca"
            onClick={closeMenu}
          >
            <span className="menu-world__visual" aria-hidden="true" />
            <span>Publicação segura</span>
          </a>
        </div>
      )}
    </>
  );
}
