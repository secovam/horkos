import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_auth/empleados")({
  staticData: { title: "Empleados" },
});
