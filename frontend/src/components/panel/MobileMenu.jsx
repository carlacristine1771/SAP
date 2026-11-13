import Icon from "./Icon.jsx";

// Mobile-only controls shared by the panel shells; hidden on desktop by
// public/css/mobile-nav.css.
export const MOBILE_MENU_ID = "painel-menu";

export function mobileDrawerProps(menu) {
  return {
    id: MOBILE_MENU_ID,
    ref: menu.drawerRef,
    ...(menu.open
      ? { role: "dialog", "aria-modal": true, "aria-label": "Menu do painel" }
      : {}),
  };
}

export function MobileMenuToggle({ menu }) {
  return (
    <button
      type="button"
      className="mobile-menu-toggle"
      onClick={menu.toggle}
      aria-label="Abrir menu"
      aria-controls={MOBILE_MENU_ID}
      aria-expanded={menu.open}
    >
      <Icon name="menu" />
    </button>
  );
}

export function MobileMenuClose({ menu }) {
  return (
    <button
      type="button"
      className="mobile-menu-close"
      onClick={menu.close}
      aria-label="Fechar menu"
    >
      <Icon name="close" />
    </button>
  );
}

export function MobileMenuOverlay({ menu }) {
  return (
    <div
      className="mobile-menu-overlay"
      hidden={!menu.open}
      onClick={menu.close}
      aria-hidden="true"
    />
  );
}
