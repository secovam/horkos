import { Button } from "@horkos/ui/components/button";
import { ArrowUpIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export function ScrollToTop() {
  const [scrolled, setScrolled] = useState(false);

  const marker = useRef<HTMLDivElement>(null);

  // The button shows once the first 400px of the page are out of view.
  useEffect(() => {
    const node = marker.current;

    if (!node) {
      return;
    }

    const observer = new IntersectionObserver((entries) =>
      setScrolled(entries.every((entry) => !entry.isIntersecting))
    );

    observer.observe(node);

    return () => observer.disconnect();
  }, []);

  return (
    <>
      <div
        ref={marker}
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-100"
      />
      {scrolled ? (
        <div className="fixed right-6 bottom-6 z-40">
          <Button
            variant="outline"
            size="icon"
            aria-label="Volver arriba"
            onClick={() => {
              const reduceMotion = window.matchMedia(
                "(prefers-reduced-motion: reduce)"
              ).matches;

              window.scrollTo({
                top: 0,
                behavior: reduceMotion ? "auto" : "smooth",
              });
            }}
          >
            <ArrowUpIcon />
          </Button>
        </div>
      ) : null}
    </>
  );
}
