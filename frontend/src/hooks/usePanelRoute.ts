import { useCallback, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";

interface PanelRouteOptions {
  role: string;
  defaultPanel: string;
  allowedPanels: readonly string[];
}

export function usePanelRoute({
  role,
  defaultPanel,
  allowedPanels,
}: PanelRouteOptions) {
  const { section } = useParams();
  const routerNavigate = useNavigate();
  const activePanel =
    section && allowedPanels.includes(section) ? section : defaultPanel;

  useEffect(() => {
    if (section && !allowedPanels.includes(section)) {
      routerNavigate(`/painel/${role}/${defaultPanel}`, { replace: true });
    }
  }, [allowedPanels, defaultPanel, role, routerNavigate, section]);

  const navigate = useCallback(
    (nextPanel: string, options?: { replace?: boolean }) => {
      if (!allowedPanels.includes(nextPanel)) return;
      routerNavigate(`/painel/${role}/${nextPanel}`, options);
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [allowedPanels, role, routerNavigate],
  );

  return { activePanel, navigate };
}
