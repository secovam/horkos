import { createFileRoute } from "@tanstack/react-router";

import MagicLinkForm from "@/components/auth/magic-link-form";

export const Route = createFileRoute("/login")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <main className="login-background flex min-h-svh justify-center">
      <MagicLinkForm />
    </main>
  );
}
