import { createFileRoute, redirect } from "@tanstack/react-router";

import MagicLinkForm from "@/components/auth/magic-link-form";
import { getUser } from "@/functions/get-user";

export const Route = createFileRoute("/login")({
  component: RouteComponent,
  beforeLoad: async () => {
    const session = await getUser();

    if (session) {
      throw redirect({ to: "/dashboard" });
    }
  },
});

function RouteComponent() {
  return (
    <main className="login-background flex min-h-svh items-center justify-center">
      <MagicLinkForm />
    </main>
  );
}
