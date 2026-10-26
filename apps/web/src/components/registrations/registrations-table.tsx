import { Button } from "@horkos/ui/components/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@horkos/ui/components/table";
import {
  ClipboardListIcon,
  SearchXIcon,
  TriangleAlertIcon,
} from "lucide-react";

import { EmptyStateCard } from "@/components/invitations/invitations-empty-state";
import {
  DeleteRegistrationAction,
  EditRegistrationDialog,
} from "@/components/registrations/registration-actions";
import type { listRegistrations } from "@/functions/registrations";

interface RegistrationsTableProps {
  rows: Awaited<ReturnType<typeof listRegistrations>>["rows"] | undefined;
  isError: boolean;
  q: string;
  onRetry: () => void;
}

const dateFormat = new Intl.DateTimeFormat("es-MX", { dateStyle: "medium" });

function StatusContent({ rows, isError, q, onRetry }: RegistrationsTableProps) {
  if (isError) {
    return (
      <EmptyStateCard
        icon={<TriangleAlertIcon />}
        title="No se pudieron cargar los registros"
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
        description="Ningún registro coincide con la búsqueda."
      />
    );
  }

  return (
    <EmptyStateCard
      icon={<ClipboardListIcon />}
      title="No hay registros pendientes"
      description="Comparte la página /registro con los empleados. Quienes se registren aparecerán aquí."
    />
  );
}

export function RegistrationsTable(props: RegistrationsTableProps) {
  return (
    <div className="overflow-hidden rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Empleado</TableHead>
            <TableHead>Correo</TableHead>
            <TableHead>Registro</TableHead>
            <TableHead>
              <span className="sr-only">Acciones</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {props.rows?.map((registration) => (
            <TableRow key={registration.id}>
              <TableCell>
                <span className="font-medium">{registration.employeeName}</span>
              </TableCell>
              <TableCell>
                <span className="text-muted-foreground">
                  {registration.email}
                </span>
              </TableCell>
              <TableCell>
                <span className="text-muted-foreground">
                  {dateFormat.format(registration.createdAt)}
                </span>
              </TableCell>
              <TableCell>
                <div className="flex justify-end gap-1">
                  <EditRegistrationDialog registration={registration} />
                  <DeleteRegistrationAction registration={registration} />
                </div>
              </TableCell>
            </TableRow>
          ))}
          {!props.rows?.length && (
            <TableRow>
              <TableCell colSpan={4}>
                <StatusContent {...props} />
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
