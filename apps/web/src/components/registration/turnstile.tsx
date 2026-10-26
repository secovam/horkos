import { useEffect, useEffectEvent, useRef } from "react";

// Loaded by the route's head; `onload` covers the script arriving after hydration.
export const TURNSTILE_SCRIPT_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=onTurnstileLoad";

interface TurnstileApi {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      language: string;
      callback: (token: string) => void;
      "expired-callback": () => void;
      "error-callback": () => void;
    }
  ) => string;
  remove: (widgetId: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
    onTurnstileLoad?: () => void;
  }
}

// Tokens are single use: remount (change `key`) to get a fresh one after a failed submit.
export function Turnstile({
  siteKey,
  onToken,
}: {
  siteKey: string;
  onToken: (token: string) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const emitToken = useEffectEvent(onToken);

  useEffect(() => {
    let widgetId: string | null = null;

    function render() {
      if (!window.turnstile || !container.current) {
        return;
      }

      widgetId = window.turnstile.render(container.current, {
        sitekey: siteKey,
        language: "es",
        callback: (token) => emitToken(token),
        "expired-callback": () => emitToken(""),
        "error-callback": () => emitToken(""),
      });
    }

    if (window.turnstile) {
      render();
    } else {
      window.onTurnstileLoad = render;
    }

    return () => {
      delete window.onTurnstileLoad;

      if (widgetId) {
        window.turnstile?.remove(widgetId);
      }
    };
  }, [siteKey]);

  return <div ref={container} />;
}
