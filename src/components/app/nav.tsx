"use client";

import { useCallback } from "react";

// Navegación instantánea: toda la app vive en el teléfono, así que cambiar de
// pantalla no espera al servidor. Next sincroniza usePathname con pushState.
const scrollPorRuta = new Map<string, number>();

function ruta() {
  return window.location.pathname + window.location.search;
}

export function ir(href: string, { reemplazar = false } = {}) {
  if (href === ruta()) {
    window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }
  scrollPorRuta.set(ruta(), window.scrollY);
  if (reemplazar) window.history.replaceState(null, "", href);
  else window.history.pushState(null, "", href);
  // Las pestañas recuerdan dónde ibas; lo demás abre arriba.
  const y = scrollPorRuta.get(href) ?? 0;
  requestAnimationFrame(() => window.scrollTo(0, y));
}

export function useIr() {
  return {
    push: useCallback((href: string) => ir(href), []),
    replace: useCallback((href: string) => ir(href, { reemplazar: true }), []),
  };
}

type Props = React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string };

export function Enlace({ href, onClick, children, ...resto }: Props) {
  return (
    <a
      href={href}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
        event.preventDefault();
        if (navigator.vibrate) navigator.vibrate(5);
        ir(href);
      }}
      {...resto}
    >
      {children}
    </a>
  );
}
