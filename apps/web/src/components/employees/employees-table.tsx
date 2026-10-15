import { Badge } from "@horkos/ui/components/badge";
import { Button, buttonVariants } from "@horkos/ui/components/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@horkos/ui/components/table";
import { Link } from "@tanstack/react-router";
import { SearchXIcon, TriangleAlertIcon, UsersIcon } from "lucide-react";

import { EmptyStateCard } from "@/components/invitations/invitations-empty-state";
import type { listEmployees } from "@/functions/employees";

interface EmployeesTableProps {
  rows: Awaited<ReturnType<typeof listEmployees>>["rows"] | undefined;
  isError: boolean;
  q: string;
  onRetry: () => void;
}

const dateFormat = new Intl.DateTimeFormat("es-MX", { dateStyle: "medium" });

function StatusContent({ rows, isError, q, onRetry }: EmployeesTableProps) {
  if (isError) {
    return (
      <EmptyStateCard
        icon={<TriangleAlertIcon />}
        title="No se pudieron cargar los empleados"
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

  if (q) {
    return (
      <EmptyStateCard
        icon={<SearchXIcon />}
        title="Sin resultados"
        description="Ningún empleado coincide con la búsqueda."
      />
    );
  }

  return (
    <EmptyStateCard
      icon={<UsersIcon />}
      title="Aún no hay información recibida"
      description="Cuando un empleado envíe sus datos, aparecerá aquí para que lo revises."
    />
  );
}

export function EmployeesTable(props: EmployeesTableProps) {
  return (
    <div className="overflow-hidden rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Empleado</TableHead>
            <TableHead>Correo</TableHead>
            <TableHead>Enviado el</TableHead>
            <TableHead>Revisión</TableHead>
            <TableHead>
              <span className="sr-only">Acciones</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {props.rows?.map((employee) => (
            <TableRow key={employee.id}>
              <TableCell>
                <span className="font-medium">{employee.employeeName}</span>
              </TableCell>
              <TableCell>
                <span className="text-muted-foreground">{employee.email}</span>
              </TableCell>
              <TableCell>
                <span className="text-muted-foreground">
                  {employee.submittedAt
                    ? dateFormat.format(employee.submittedAt)
                    : "—"}
                </span>
              </TableCell>
              <TableCell>
                {employee.needsAttention ? (
                  <Badge variant="destructive">Revisar</Badge>
                ) : (
                  <Badge variant="secondary">Sin diferencias</Badge>
                )}
              </TableCell>
              <TableCell>
                <div className="flex justify-end">
                  <Link
                    className={buttonVariants({
                      variant: "ghost-primary",
                      size: "sm",
                    })}
                    to="/empleados/$invitationId"
                    params={{ invitationId: employee.id }}
                    aria-label={`Ver detalle: ${employee.employeeName}`}
                  >
                    Ver detalle
                  </Link>
                </div>
              </TableCell>
            </TableRow>
          ))}
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
