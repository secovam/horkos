import { createFileRoute } from "@tanstack/react-router";

import MagicLinkForm from "@/components/magic-link-form";

export const Route = createFileRoute("/login")({
  component: RouteComponent,
});

function RouteComponent() {
  return <MagicLinkForm />;
}
