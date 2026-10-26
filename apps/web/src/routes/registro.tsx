import { createFileRoute } from "@tanstack/react-router";

import { RegistrationForm } from "@/components/registration/registration-form";
import { TURNSTILE_SCRIPT_SRC } from "@/components/registration/turnstile";
import { getTurnstileSiteKey } from "@/functions/registrations";

// Public: employees register themselves here, then HR invites them from "Registros".
export const Route = createFileRoute("/registro")({
  loader: () => getTurnstileSiteKey(),
  head: () => ({ scripts: [{ src: TURNSTILE_SCRIPT_SRC, async: true }] }),
  component: RegistrationPage,
});

function RegistrationPage() {
  const { siteKey } = Route.useLoaderData();

  return (
    <main className="bg-muted flex min-h-svh justify-center p-4">
      <div className="flex w-full max-w-md flex-col justify-center py-4">
        <RegistrationForm siteKey={siteKey} />
      </div>
    </main>
  );
}
