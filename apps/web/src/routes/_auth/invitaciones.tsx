import { Badge } from "@horkos/ui/components/badge";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@horkos/ui/components/input-group";
import { Tabs, TabsList, TabsTrigger } from "@horkos/ui/components/tabs";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { MailCheckIcon, MailIcon, MailXIcon, SearchIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { InvitationsTable } from "@/components/invitations/invitations-table";
import { NewInvitationDialog } from "@/components/invitations/new-invitation-dialog";
import { PageHeader } from "@/components/layout/page-header";
import { Pagination } from "@/components/layout/pagination";
import { listInvitations } from "@/functions/invitations";
import {
  INVITATIONS_PAGE_SIZE,
  INVITATION_TABS,
  invitationSearchSchema,
} from "@/lib/invitation";
import type { InvitationTab } from "@/lib/invitation";

const SEARCH_DEBOUNCE_MS = 300;

export const Route = createFileRoute("/_auth/invitaciones")({
  validateSearch: invitationSearchSchema,
  staticData: { title: "Invitaciones" },
  component: InvitationsPage,
});

const TAB_ICONS = { active: MailCheckIcon, revoked: MailXIcon } as const;

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

  const { data, isError, refetch } = useQuery({
    queryKey: ["invitations", search, debouncedQ],
    queryFn: () => listInvitations({ data: { ...search, q: debouncedQ } }),
    placeholderData: keepPreviousData,
  });

  const total = data?.total ?? 0;

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

      <InvitationsTable
        rows={data?.rows}
        isError={isError}
        tab={search.tab}
        q={debouncedQ}
        onRetry={() => refetch()}
      />

      <Pagination
        page={search.page}
        total={total}
        pageSize={INVITATIONS_PAGE_SIZE}
        onPageChange={(page) =>
          navigate({ search: (prev) => ({ ...prev, page }) })
        }
      />
    </>
  );
}
