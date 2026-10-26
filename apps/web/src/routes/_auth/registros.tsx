import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@horkos/ui/components/input-group";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ClipboardListIcon, SearchIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { PageHeader } from "@/components/layout/page-header";
import { Pagination } from "@/components/layout/pagination";
import { InviteAllButton } from "@/components/registrations/registration-actions";
import { RegistrationsTable } from "@/components/registrations/registrations-table";
import { listRegistrations } from "@/functions/registrations";
import {
  REGISTRATIONS_PAGE_SIZE,
  registrationSearchSchema,
} from "@/lib/registration";

const SEARCH_DEBOUNCE_MS = 300;

export const Route = createFileRoute("/_auth/registros")({
  validateSearch: registrationSearchSchema,
  staticData: { title: "Registros" },
  component: RegistrationsPage,
});

function RegistrationsPage() {
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
    queryKey: ["registrations", search, debouncedQ],
    queryFn: () => listRegistrations({ data: { ...search, q: debouncedQ } }),
    placeholderData: keepPreviousData,
  });

  return (
    <>
      <PageHeader
        icon={ClipboardListIcon}
        title="Registros"
        description="Empleados que se registraron en la página pública y esperan su invitación"
        actions={<InviteAllButton pending={data?.pending ?? 0} />}
      />

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

      <RegistrationsTable
        rows={data?.rows}
        isError={isError}
        q={debouncedQ}
        onRetry={() => refetch()}
      />

      <Pagination
        page={search.page}
        total={data?.total ?? 0}
        pageSize={REGISTRATIONS_PAGE_SIZE}
        onPageChange={(page) =>
          navigate({ search: (prev) => ({ ...prev, page }) })
        }
      />
    </>
  );
}
