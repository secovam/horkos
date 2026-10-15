import { Badge } from "@horkos/ui/components/badge";
import { Button, buttonVariants } from "@horkos/ui/components/button";
import { Link, createFileRoute, notFound } from "@tanstack/react-router";
import { ArrowLeftIcon, UserSearchIcon, UsersIcon } from "lucide-react";
import { useState } from "react";

import { EmployeeDocuments } from "@/components/employees/employee-documents";
import { EmployeeEditForm } from "@/components/employees/employee-edit-form";
import { FieldReviewSection } from "@/components/employees/field-review-section";
import { RecordAction } from "@/components/employees/record-action";
import { EmptyStateCard } from "@/components/invitations/invitations-empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { getEmployee } from "@/functions/employees";
import { recordState } from "@/lib/employee-record";

const dateFormat = new Intl.DateTimeFormat("es-MX", {
  dateStyle: "long",
  timeStyle: "short",
});

const SECTIONS = ["personal", "address", "beneficiary"] as const;

export const Route = createFileRoute("/_auth/empleados/$invitationId")({
  staticData: { title: "Empleado" },
  loader: async ({ params }) => {
    const employee = await getEmployee({
      data: { invitationId: params.invitationId },
    });

    if (!employee) {
      throw notFound();
    }

    return employee;
  },
  notFoundComponent: EmployeeNotFound,
  component: EmployeePage,
});

function EmployeeNotFound() {
  return (
    <EmptyStateCard
      icon={<UserSearchIcon />}
      title="No encontramos este empleado"
      description="La invitación no existe, fue revocada o el empleado aún no envía su información."
      action={
        <Link
          className={buttonVariants({ variant: "outline" })}
          to="/empleados"
        >
          Volver a empleados
        </Link>
      }
    />
  );
}

function StateBadge({
  confirmed,
  needsAttention,
}: {
  confirmed: boolean;
  needsAttention: boolean;
}) {
  if (confirmed) {
    return <Badge variant="default">Confirmado</Badge>;
  }

  return needsAttention ? (
    <Badge variant="destructive">Revisar</Badge>
  ) : (
    <Badge variant="secondary">Sin diferencias</Badge>
  );
}

function EmployeePage() {
  const { employee, values, review, documents, extractions } =
    Route.useLoaderData();

  const { invitationId } = Route.useParams();
  const [editing, setEditing] = useState(false);
  const confirmed = recordState(employee.hrCompletedAt) === "confirmed";

  return (
    <>
      <PageHeader
        icon={UsersIcon}
        title={employee.employeeName}
        description={`${employee.email} · Enviado el ${
          employee.submittedAt ? dateFormat.format(employee.submittedAt) : "—"
        }`}
        actions={
          <div className="flex items-center gap-3">
            <StateBadge
              confirmed={confirmed}
              needsAttention={review.needsAttention}
            />
            {confirmed ? (
              <RecordAction action="reopen" invitationId={invitationId} />
            ) : null}
            {confirmed || editing ? null : (
              <>
                <Button variant="outline" onClick={() => setEditing(true)}>
                  Editar datos
                </Button>
                <RecordAction
                  action="confirm"
                  invitationId={invitationId}
                  needsAttention={review.needsAttention}
                />
              </>
            )}
            <Link
              className={buttonVariants({ variant: "outline" })}
              to="/empleados"
            >
              <ArrowLeftIcon data-icon="inline-start" />
              Volver a empleados
            </Link>
          </div>
        }
      />

      {editing && !confirmed ? (
        <EmployeeEditForm
          invitationId={invitationId}
          values={values}
          fields={review.fields}
          onDone={() => setEditing(false)}
        />
      ) : (
        SECTIONS.map((section) => (
          <FieldReviewSection
            key={section}
            section={section}
            fields={review.fields}
          />
        ))
      )}

      <EmployeeDocuments
        invitationId={invitationId}
        documents={documents}
        extractions={extractions}
      />
    </>
  );
}
