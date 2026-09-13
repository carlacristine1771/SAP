import { useCallback, useEffect } from "react";

const MESSAGE =
  "Existem alterações que ainda não foram salvas. Deseja descartá-las?";

export function useUnsavedChanges(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return undefined;
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [dirty]);

  return useCallback(() => !dirty || window.confirm(MESSAGE), [dirty]);
}
