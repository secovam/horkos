import { useSyncExternalStore } from "react";

const TOUCH_QUERY = "(hover: none) and (pointer: coarse)";

function subscribe(onChange: () => void) {
  const query = matchMedia(TOUCH_QUERY);

  query.addEventListener("change", onChange);

  return () => query.removeEventListener("change", onChange);
}

function getSnapshot() {
  return matchMedia(TOUCH_QUERY).matches;
}

// The server snapshot says "not touch" so SSR renders the form; a touch device swaps after hydration.
export function useTouchDevice() {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
