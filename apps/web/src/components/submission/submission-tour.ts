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
      "Sube cada archivo en PDF, de hasta 10 MB. Al subirlo, leemos el documento y llenamos tus datos por ti. Tus datos se habilitan cuando terminemos de leer los 3.",
  },
  {
    anchor: "personal",
    title: "Datos personales",
    description:
      "Revisa lo que llenamos con tus constancias y corrige lo que haga falta. Si no pudimos leer un documento, escribe el dato a mano.",
  },
  {
    anchor: "address",
    title: "Domicilio",
    description:
      "Revisa que coincida con tu comprobante de domicilio y completa lo que falte.",
  },
  {
    anchor: "beneficiary",
    title: "Beneficiario",
    description:
      "Escribe el nombre de la persona que designas como beneficiaria y elige qué parentesco tiene contigo.",
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
  popover: { title, description, side: "left", align: "start" },
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
      smoothScroll: false,
      allowClose: true,
      showProgress: true,
      progressText: "{{current}} de {{total}}",
      nextBtnText: "Siguiente",
      prevBtnText: "Anterior",
      doneBtnText: "Listo",
      onPopoverRender: ({ wrapper, closeButton }) => {
        closeButton.setAttribute("aria-label", "Cerrar guía");
        wrapper.setAttribute("tabindex", "-1");
      },
      // driver.js focuses the close button, which draws a focus ring on every step.
      // Focusing the popover itself keeps keyboard use (Tab, Esc, arrows) without it.
      onHighlighted: () => {
        document
          .querySelector<HTMLElement>(".driver-popover")
          ?.focus({ preventScroll: true });
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
