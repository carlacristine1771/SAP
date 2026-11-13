import { useCallback, useEffect, useRef, useState } from "react";
import { useModalFocus } from "./useModalFocus.ts";

// Same breakpoint as the mobile rules in public/css/mobile-nav.css.
export const MOBILE_MENU_QUERY = "(max-width: 900px)";

/**
 * Side menu of the panels on mobile. Focus, Tab, Escape and the page scroll
 * lock come from useModalFocus; widening to desktop closes the menu.
 */
export function useMobileMenu() {
  const [open, setOpen] = useState(false);
  const drawerRef = useRef<HTMLElement | null>(null);
  const close = useCallback(() => setOpen(false), []);
  const toggle = useCallback(() => setOpen((current) => !current), []);

  useEffect(() => {
    if (!open || typeof window.matchMedia !== "function") return;
    const query = window.matchMedia(MOBILE_MENU_QUERY);
    const handleChange = () => {
      if (!query.matches) setOpen(false);
    };
    query.addEventListener("change", handleChange);
    return () => query.removeEventListener("change", handleChange);
  }, [open]);

  useModalFocus(drawerRef, open, close);

  return { open, close, toggle, drawerRef };
}
