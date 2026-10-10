import { Badge } from "@horkos/ui/components/badge";
import { Button } from "@horkos/ui/components/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@horkos/ui/components/table";
import { TriangleAlertIcon } from "lucide-react";

import { InvitationAction } from "@/components/invitations/invitation-action";
import {
  EmptyStateCard,
  InvitationsEmptyState,
} from "@/components/invitations/invitations-empty-state";
import type { listInvitations } from "@/functions/invitations";
import { INVITATION_STATUS, invitationStatus } from "@/lib/invitation";
import type { InvitationTab } from "@/lib/invitation";

interface InvitationsTableProps {
  rows: Awaited<ReturnType<typeof listInvitations>>["rows"] | undefined;
  isError: boolean;
  tab: InvitationTab;
  q: string;
  onRetry: () => void;
}

const dateFormat = new Intl.DateTimeFormat("es-MX", { dateStyle: "medium" });

function StatusContent({
  rows,
  isError,
  tab,
  q,
  onRetry,
}: InvitationsTableProps) {
  if (isError) {
    return (
      <EmptyStateCard
        icon={<TriangleAlertIcon />}
        title="No se pudieron cargar las invitaciones"
        description="Revisa tu conexión e intenta de nuevo."
        action={
          <Button variant="outline" onClick={onRetry}>
            Reintentar
          </Button>
        }
      />
    );
  }

  if (!rows) {
    return <p className="text-muted-foreground py-8 text-center">Cargando…</p>;
  }

  return <InvitationsEmptyState tab={tab} q={q} />;
}

export function InvitationsTable(props: InvitationsTableProps) {
  return (
    <div className="overflow-hidden rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Empleado</TableHead>
            <TableHead>Correo</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Último envío</TableHead>
            <TableHead>
              <span className="sr-only">Acciones</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {props.rows?.map((invitation) => {
            const status = INVITATION_STATUS[invitationStatus(invitation)];

            return (
              <TableRow key={invitation.id}>
                <TableCell>
                  <span className="font-medium">{invitation.employeeName}</span>
                </TableCell>
                <TableCell>
                  <span className="text-muted-foreground">
                    {invitation.email}
                  </span>
                </TableCell>
                <TableCell>
                  <Badge variant={status.variant}>{status.label}</Badge>
                </TableCell>
                <TableCell>
                  <span className="text-muted-foreground">
                    {invitation.sentAt
                      ? dateFormat.format(invitation.sentAt)
                      : "—"}
                  </span>
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    {invitation.revokedAt ? (
                      <InvitationAction
                        action="reactivate"
                        invitation={invitation}
                      />
                    ) : (
                      <>
                        <InvitationAction
                          action="resend"
                          invitation={invitation}
                        />
                        <InvitationAction
                          action="revoke"
                          invitation={invitation}
                        />
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
          {!props.rows?.length && (
            <TableRow>
              <TableCell colSpan={5}>
                <StatusContent {...props} />
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
