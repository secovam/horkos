import { Badge } from "@horkos/ui/components/badge";
import { Button } from "@horkos/ui/components/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@horkos/ui/components/empty";
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
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  MailCheckIcon,
  MailIcon,
  MailXIcon,
  SearchIcon,
  SearchXIcon,
} from "lucide-react";
import { useEffect, useState } from "react";

import { InvitationAction } from "@/components/invitation-action";
import { NewInvitationDialog } from "@/components/new-invitation-dialog";
import { PageHeader } from "@/components/page-header";
import { listInvitations } from "@/functions/invitations";
import {
  INVITATIONS_PAGE_SIZE,
  INVITATION_STATUS,
  INVITATION_TABS,
  invitationSearchSchema,
  invitationStatus,
} from "@/lib/invitation";
import type { InvitationTab } from "@/lib/invitation";

const SEARCH_DEBOUNCE_MS = 300;

export const Route = createFileRoute("/_auth/invitaciones")({
  validateSearch: invitationSearchSchema,
  staticData: { title: "Invitaciones" },
  component: InvitationsPage,
});

const TAB_ICONS = { active: MailCheckIcon, revoked: MailXIcon } as const;

const dateFormat = new Intl.DateTimeFormat("es-MX", { dateStyle: "medium" });

function emptyState(tab: InvitationTab, q: string) {
  if (q) {
    return {
      icon: <SearchXIcon />,
      title: "Sin resultados",
      description: "Ninguna invitación coincide con la búsqueda.",
    };
  }

  if (tab === "revoked") {
    return {
      icon: <MailXIcon />,
      title: "No hay invitaciones revocadas",
      description: "Las invitaciones que revoques aparecerán aquí.",
    };
  }

  return {
    icon: <MailIcon />,
    title: "Aún no hay invitaciones",
    description:
      "Invita a un empleado para que suba sus documentos y complete sus datos.",
    action: <NewInvitationDialog />,
  };
}

function InvitationsPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  // The search term stays in component state so employee names and emails never reach the URL.
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedQ(q), SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timeout);
  }, [q]);

  const { data } = useQuery({
    queryKey: ["invitations", search, debouncedQ],
    queryFn: () => listInvitations({ data: { ...search, q: debouncedQ } }),
  });

  const total = data?.total ?? 0;
  const pageOffset = (search.page - 1) * INVITATIONS_PAGE_SIZE;
  const pageHasRows = pageOffset < total;

  const firstShown = pageHasRows ? pageOffset + 1 : 0;

  const lastShown = pageHasRows
    ? Math.min(pageOffset + INVITATIONS_PAGE_SIZE, total)
    : 0;

  const isActiveTab = search.tab === "active";

  const empty =
    data?.rows.length === 0 ? emptyState(search.tab, debouncedQ) : null;

  return (
    <>
      <PageHeader
        icon={MailIcon}
        title="Invitaciones"
        description="Invita a empleados a subir sus documentos y completar sus datos"
        actions={<NewInvitationDialog />}
      />

      <Tabs
        value={search.tab}
        onValueChange={(tab: InvitationTab) =>
          navigate({ search: (prev) => ({ ...prev, tab, page: 1 }) })
        }
      >
        <div className="border-b">
          <TabsList variant="line">
            {INVITATION_TABS.map(({ value, label }) => {
              const Icon = TAB_ICONS[value];

              return (
                <TabsTrigger key={value} value={value}>
                  <Icon data-icon="inline-start" />
                  {label}
                  <Badge variant="info">{data?.counts[value] ?? 0}</Badge>
                </TabsTrigger>
              );
            })}
          </TabsList>
        </div>
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
            maxLength={200}
            value={q}
            onChange={(event) => {
              setQ(event.target.value);
              navigate({
                search: (prev) => ({ ...prev, page: 1 }),
                replace: true,
              });
            }}
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
            {data ? null : (
              <TableRow>
                <TableCell colSpan={5}>
                  <p className="text-muted-foreground py-8 text-center">
                    Cargando…
                  </p>
                </TableCell>
              </TableRow>
            )}
            {empty ? (
              <TableRow>
                <TableCell colSpan={5}>
                  <div className="whitespace-normal">
                    <Empty>
                      <EmptyHeader>
                        <EmptyMedia variant="icon">{empty.icon}</EmptyMedia>
                        <EmptyTitle>{empty.title}</EmptyTitle>
                        <EmptyDescription>{empty.description}</EmptyDescription>
                      </EmptyHeader>
                      {"action" in empty ? (
                        <EmptyContent>{empty.action}</EmptyContent>
                      ) : null}
                    </Empty>
                  </div>
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
            disabled={!pageHasRows || lastShown >= total}
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
