import { Card, CardContent } from "@horkos/ui/components/card";
import { createFileRoute } from "@tanstack/react-router";
import { MailCheckIcon, MailXIcon } from "lucide-react";

import { openInvitation } from "@/functions/employee-invitation";

export const Route = createFileRoute("/invitacion/$token")({
  loader: ({ params }) => openInvitation({ data: { token: params.token } }),
  // The URL carries the token, so it must not leak through the Referer header.
  head: () => ({
    meta: [
      { name: "referrer", content: "no-referrer" },
      { title: "Tu invitación · Horkos" },
    ],
  }),
  component: InvitationPage,
});

const CONTENT = {
  valid: {
    icon: MailCheckIcon,
    iconClass: "bg-primary text-primary-foreground",
    title: "Tu invitación fue recibida",
    body: "Pronto podrás subir tus documentos y completar tus datos desde este mismo enlace.",
  },
  invalid: {
    icon: MailXIcon,
    iconClass: "bg-muted text-muted-foreground",
    title: "Este enlace no está disponible",
    body: "Puede que haya sido reemplazado por uno más reciente. Revisa tu correo o pide un enlace nuevo a Recursos Humanos.",
  },
} as const;

function InvitationPage() {
  const { valid } = Route.useLoaderData();
  const content = CONTENT[valid ? "valid" : "invalid"];

  return (
    <main className="bg-muted flex min-h-svh items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card>
          <CardContent>
            <div className="flex flex-col items-center gap-4 py-6 text-center">
              <div
                className={`flex size-12 items-center justify-center rounded-full ${content.iconClass}`}
              >
                <content.icon className="size-6" />
              </div>
              <h1 className="text-primary text-xl font-semibold text-balance">
                {content.title}
              </h1>
              <p className="text-muted-foreground text-pretty">
                {content.body}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
