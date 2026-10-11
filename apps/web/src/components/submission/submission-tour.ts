import { driver } from "driver.js";
import type { Driver, DriveStep } from "driver.js";
import { useCallback, useEffect, useRef } from "react";

// Holds no token or personal data: it only says this browser already saw the tour.
const SEEN_KEY = "horkos:submission-tour:v1";

const TOUR_STEPS = [
  {
    anchor: "welcome",
    title: "Antes de empezar",
    description:
      "Ten a la mano tus 3 documentos: constancia de situación fiscal, constancia del IMSS y comprobante de domicilio.",
  },
  {
    anchor: "documents",
    title: "Documentos",
    description:
      "Sube cada archivo en PDF, JPG o PNG. En el celular puedes tomar la foto desde aquí.",
  },
  {
    anchor: "personal",
    title: "Datos personales",
    description:
      "Tu RFC, CURP y NSS vienen en tus constancias. Cópialos tal como aparecen.",
  },
  {
    anchor: "address",
    title: "Domicilio",
    description: "Escríbelo como aparece en tu comprobante de domicilio.",
  },
  {
    anchor: "submit",
    title: "Enviar",
    description:
      "Recursos Humanos revisa tu información antes de preparar el contrato. Después de enviar ya no podrás editarla.",
  },
] as const;

export type TourAnchor = (typeof TOUR_STEPS)[number]["anchor"];

export function tourAnchor(anchor: TourAnchor) {
  return { "data-tour": anchor };
}

const STEPS: DriveStep[] = TOUR_STEPS.map(({ anchor, title, description }) => ({
  element: `[data-tour="${anchor}"]`,
  popover: { title, description },
}));

function hasSeenTour() {
  try {
    return localStorage.getItem(SEEN_KEY) !== null;
  } catch {
    // Storage can be blocked (private mode); showing the tour again is harmless.
    return false;
  }
}

function markTourSeen() {
  try {
    localStorage.setItem(SEEN_KEY, "1");
  } catch {
    // See hasSeenTour.
  }
}

export function useSubmissionTour() {
  const tourRef = useRef<Driver | null>(null);

  const start = useCallback(() => {
    tourRef.current?.destroy();

    const overlayColor = getComputedStyle(document.documentElement)
      .getPropertyValue("--foreground")
      .trim();

    const animate = !matchMedia("(prefers-reduced-motion: reduce)").matches;

    const tour = driver({
      steps: STEPS,
      popoverClass: "horkos-tour",
      overlayColor,
      overlayOpacity: 0.6,
      stagePadding: 8,
      stageRadius: 12,
      animate,
      smoothScroll: animate,
      allowClose: true,
      showProgress: true,
      progressText: "{{current}} de {{total}}",
      nextBtnText: "Siguiente",
      prevBtnText: "Anterior",
      doneBtnText: "Listo",
      onPopoverRender: ({ closeButton }) => {
        closeButton.setAttribute("aria-label", "Cerrar guía");
      },
      // Only runs when the person ends the tour (close, Esc, overlay, Listo).
      // Tearing it down from code with destroy() skips it, so a remount does not count as seen.
      onDestroyStarted: () => {
        markTourSeen();
        tour.destroy();
      },
    });

    tourRef.current = tour;
    tour.drive();
  }, []);

  useEffect(() => {
    if (!hasSeenTour()) {
      start();
    }

    return () => tourRef.current?.destroy();
  }, [start]);

  return start;
}
