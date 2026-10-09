import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@horkos/ui/components/empty";
import { MailIcon, MailXIcon, SearchXIcon } from "lucide-react";
import type { ReactNode } from "react";

import { NewInvitationDialog } from "@/components/invitations/new-invitation-dialog";
import type { InvitationTab } from "@/lib/invitation";

export function EmptyStateCard({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="whitespace-normal">
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">{icon}</EmptyMedia>
          <EmptyTitle>{title}</EmptyTitle>
          <EmptyDescription>{description}</EmptyDescription>
        </EmptyHeader>
        {action && <EmptyContent>{action}</EmptyContent>}
      </Empty>
    </div>
  );
}

export function InvitationsEmptyState({
  tab,
  q,
}: {
  tab: InvitationTab;
  q: string;
}) {
  if (q) {
    return (
      <EmptyStateCard
        icon={<SearchXIcon />}
        title="Sin resultados"
        description="Ninguna invitación coincide con la búsqueda."
      />
    );
  }

  if (tab === "revoked") {
    return (
      <EmptyStateCard
        icon={<MailXIcon />}
        title="No hay invitaciones revocadas"
        description="Las invitaciones que revoques aparecerán aquí."
      />
    );
  }

  return (
    <EmptyStateCard
      icon={<MailIcon />}
      title="Aún no hay invitaciones"
      description="Invita a un empleado para que suba sus documentos y complete sus datos."
      action={<NewInvitationDialog />}
    />
  );
}
