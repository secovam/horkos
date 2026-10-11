import { Card, CardContent } from "@horkos/ui/components/card";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { MailCheckIcon, MailXIcon, MonitorIcon } from "lucide-react";
import { useEffect, useRef } from "react";

import { SubmissionForm } from "@/components/submission/submission-form";
import {
  checkInvitation,
  openInvitation,
} from "@/functions/employee-invitation";
import { useTouchDevice } from "@/lib/use-touch-device";

export const Route = createFileRoute("/invitacion/$token")({
  loader: ({ params }) => checkInvitation({ data: { token: params.token } }),
  // The URL carries the token, so it must not leak through the Referer header.
  head: () => ({ meta: [{ name: "referrer", content: "no-referrer" }] }),
  component: InvitationPage,
});

const NOTICE = {
  submitted: {
    icon: MailCheckIcon,
    iconClass: "bg-primary text-primary-foreground",
    title: "Recibimos tu información",
    body: "Recursos Humanos la revisará y se pondrá en contacto contigo si necesita algo más. Ya puedes cerrar esta página.",
  },
  unavailable: {
    icon: MailXIcon,
    iconClass: "bg-muted text-muted-foreground",
    title: "Este enlace no está disponible",
    body: "Puede que haya sido reemplazado por uno más reciente. Revisa tu correo o pide un enlace nuevo a Recursos Humanos.",
  },
  computerOnly: {
    icon: MonitorIcon,
    iconClass: "bg-muted text-muted-foreground",
    title: "Abre este enlace en una computadora",
    body: "El formulario necesita archivos PDF y se llena desde el navegador de una computadora. El mismo enlace funciona ahí.",
  },
} as const;

function InvitationPage() {
  const invitation = Route.useLoaderData();
  const { token } = Route.useParams();
  const router = useRouter();
  const recorded = useRef(false);
  const open = invitation.status === "open";
  const touchDevice = useTouchDevice();

  // Recorded from the browser, after hydration, so only a person opening the link counts.
  useEffect(() => {
    if (!open || recorded.current) {
      return;
    }

    recorded.current = true;
    void openInvitation({ data: { token } });
  }, [open, token]);

  return (
    <main className="bg-muted flex min-h-svh justify-center p-4">
      <div className="flex w-full max-w-md flex-col justify-center py-4">
        {open && !touchDevice ? (
          <SubmissionForm
            token={token}
            employeeName={invitation.employeeName}
            onSubmitted={() => router.invalidate()}
          />
        ) : (
          <NoticeCard
            content={NOTICE[open ? "computerOnly" : invitation.status]}
          />
        )}
      </div>
    </main>
  );
}

function NoticeCard({
  content,
}: {
  content: (typeof NOTICE)[keyof typeof NOTICE];
}) {
  return (
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
          <p className="text-muted-foreground text-pretty">{content.body}</p>
        </div>
      </CardContent>
    </Card>
  );
}
