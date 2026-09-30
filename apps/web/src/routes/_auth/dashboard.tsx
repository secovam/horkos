import { Button } from "@horkos/ui/components/button";
import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/_auth/dashboard")({
  component: RouteComponent,
});

function RouteComponent() {
  const { session } = Route.useRouteContext();
  const navigate = useNavigate();

  return (
    <main className="grid h-svh place-items-center">
      <div className="flex flex-col items-center gap-4">
        <h1 className="text-4xl font-semibold">Horkos</h1>
        <p className="text-muted-foreground">{session?.user.email}</p>
        <Button
          variant="outline"
          onClick={() =>
            authClient.signOut({
              fetchOptions: { onSuccess: () => navigate({ to: "/login" }) },
            })
          }
        >
          Cerrar sesión
        </Button>
      </div>
    </main>
  );
}
