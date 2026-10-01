import { Badge } from "@horkos/ui/components/badge";
import { Button } from "@horkos/ui/components/button";
import {
  Card,
  CardAction,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@horkos/ui/components/card";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@horkos/ui/components/input-group";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@horkos/ui/components/table";
import { Tabs, TabsList, TabsTrigger } from "@horkos/ui/components/tabs";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  MailIcon,
  SearchIcon,
} from "lucide-react";

import { InvitationAction } from "@/components/invitation-action";
import { NewInvitationDialog } from "@/components/new-invitation-dialog";
import { listInvitations } from "@/functions/invitations";
import {
  INVITATIONS_PAGE_SIZE,
  INVITATION_STATUS,
  INVITATION_TABS,
  invitationSearchSchema,
  invitationStatus,
} from "@/lib/invitation";
import type { InvitationTab } from "@/lib/invitation";

export const Route = createFileRoute("/_auth/invitaciones")({
  validateSearch: invitationSearchSchema,
  staticData: { title: "Invitaciones" },
  component: InvitationsPage,
});

const dateFormat = new Intl.DateTimeFormat("es-MX", { dateStyle: "medium" });

function tableMessage(rowCount: number | undefined, q: string) {
  if (rowCount === undefined) {
    return "Cargando…";
  }

  if (rowCount > 0) {
    return null;
  }

  return q
    ? "Ninguna invitación coincide con la búsqueda."
    : "Aún no hay invitaciones aquí.";
}

function InvitationsPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();

  const { data } = useQuery({
    queryKey: ["invitations", search],
    queryFn: () => listInvitations({ data: search }),
    placeholderData: keepPreviousData,
  });

  const total = data?.total ?? 0;

  const firstShown = Math.min(
    (search.page - 1) * INVITATIONS_PAGE_SIZE + 1,
    total
  );

  const lastShown = Math.min(search.page * INVITATIONS_PAGE_SIZE, total);
  const isActiveTab = search.tab === "active";
  const emptyMessage = tableMessage(data?.rows.length, search.q);

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="bg-muted hidden size-12 shrink-0 items-center justify-center rounded-lg sm:flex">
              <MailIcon className="size-5" />
            </div>
            <div className="grid gap-1">
              <CardTitle>
                <h1 className="text-xl font-semibold">Invitaciones</h1>
              </CardTitle>
              <CardDescription>
                Invita a empleados a subir sus documentos y completar sus datos
              </CardDescription>
            </div>
          </div>
          <CardAction>
            <NewInvitationDialog />
          </CardAction>
        </CardHeader>
      </Card>

      <Tabs
        value={search.tab}
        onValueChange={(tab: InvitationTab) =>
          navigate({ search: (prev) => ({ ...prev, tab, page: 1 }) })
        }
      >
        <TabsList variant="line">
          {INVITATION_TABS.map(({ value, label }) => (
            <TabsTrigger key={value} value={value}>
              {label}
              <Badge variant="secondary">{data?.counts[value] ?? 0}</Badge>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="w-full max-w-sm">
        <InputGroup>
          <InputGroupAddon>
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupInput
            type="search"
            aria-label="Filtrar por nombre o correo"
            placeholder="Filtrar por nombre o correo…"
            value={search.q}
            onChange={(event) =>
              navigate({
                search: (prev) => ({ ...prev, q: event.target.value, page: 1 }),
                replace: true,
              })
            }
          />
        </InputGroup>
      </div>

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
            {data?.rows.map((invitation) => {
              const status = INVITATION_STATUS[invitationStatus(invitation)];

              return (
                <TableRow key={invitation.id}>
                  <TableCell>
                    <span className="font-medium">
                      {invitation.employeeName}
                    </span>
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
                      {dateFormat.format(invitation.sentAt)}
                    </span>
                  </TableCell>
                  <TableCell>
                    {isActiveTab ? (
                      <div className="flex justify-end gap-1">
                        <InvitationAction
                          action="resend"
                          invitation={invitation}
                        />
                        <InvitationAction
                          action="revoke"
                          invitation={invitation}
                        />
                      </div>
                    ) : null}
                  </TableCell>
                </TableRow>
              );
            })}
            {emptyMessage ? (
              <TableRow>
                <TableCell colSpan={5}>
                  <p className="text-muted-foreground py-8 text-center">
                    {emptyMessage}
                  </p>
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>

      <nav
        aria-label="Paginación"
        className="text-muted-foreground flex items-center justify-between gap-4 text-sm"
      >
        <p>
          Mostrando{" "}
          <span className="text-foreground font-medium">
            {firstShown}–{lastShown}
          </span>{" "}
          de <span className="text-foreground font-medium">{total}</span>
        </p>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            disabled={search.page <= 1}
            onClick={() =>
              navigate({ search: (prev) => ({ ...prev, page: prev.page - 1 }) })
            }
          >
            <ChevronLeftIcon data-icon="inline-start" />
            Anterior
          </Button>
          <Button
            variant="ghost"
            disabled={lastShown >= total}
            onClick={() =>
              navigate({ search: (prev) => ({ ...prev, page: prev.page + 1 }) })
            }
          >
            Siguiente
            <ChevronRightIcon data-icon="inline-end" />
          </Button>
        </div>
      </nav>
    </>
  );
}
