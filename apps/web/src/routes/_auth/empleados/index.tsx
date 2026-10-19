import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@horkos/ui/components/input-group";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { SearchIcon, UsersIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { EmployeesTable } from "@/components/employees/employees-table";
import { PageHeader } from "@/components/layout/page-header";
import { Pagination } from "@/components/layout/pagination";
import { listEmployees } from "@/functions/employees";
import {
  EMPLOYEES_PAGE_SIZE,
  employeeSearchSchema,
} from "@/lib/employee-record";

const SEARCH_DEBOUNCE_MS = 300;

export const Route = createFileRoute("/_auth/empleados/")({
  validateSearch: employeeSearchSchema,
  component: EmployeesPage,
});

function EmployeesPage() {
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
    queryKey: ["employees", search, debouncedQ],
    queryFn: () => listEmployees({ data: { ...search, q: debouncedQ } }),
    placeholderData: keepPreviousData,
  });

  return (
    <>
      <PageHeader
        icon={UsersIcon}
        title="Empleados"
        description="Revisa la información y los documentos que enviaron tus empleados"
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

      <EmployeesTable
        rows={data?.rows}
        isError={isError}
        q={debouncedQ}
        onRetry={() => refetch()}
      />

      <Pagination
        page={search.page}
        total={data?.total ?? 0}
        pageSize={EMPLOYEES_PAGE_SIZE}
        onPageChange={(page) =>
          navigate({ search: (prev) => ({ ...prev, page }) })
        }
      />
    </>
  );
}
