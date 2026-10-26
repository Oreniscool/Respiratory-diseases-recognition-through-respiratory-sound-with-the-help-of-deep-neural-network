import { useEffect } from "react";
import { handlePresenterKey, usePresenter } from "./presenterStore";

export function usePresenterKeys(): void {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => handlePresenterKey(event, usePresenter.getState());
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
