import { Badge } from "@horkos/ui/components/badge";
import { Button, buttonVariants } from "@horkos/ui/components/button";
import { Dialog, DialogContent } from "@horkos/ui/components/dialog";
import { Link, createFileRoute, notFound } from "@tanstack/react-router";
import { UserSearchIcon, UsersIcon } from "lucide-react";
import { useState } from "react";

import { EmployeeDocuments } from "@/components/employees/employee-documents";
import { EmployeeEditForm } from "@/components/employees/employee-edit-form";
import { EmploymentForm } from "@/components/employees/employment-form";
import { EmploymentSection } from "@/components/employees/employment-section";
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
  loader: async ({ params }) => {
    const employee = await getEmployee({
      data: { invitationId: params.invitationId },
    });

    if (!employee) {
      throw notFound();
    }

    return { ...employee, crumb: employee.employee.employeeName };
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
  const {
    employee,
    values,
    employmentValues,
    employmentComplete,
    imssRegistration,
    review,
    documents,
    extractions,
  } = Route.useLoaderData();

  const { invitationId } = Route.useParams();

  const [editing, setEditing] = useState<"none" | "submission" | "employment">(
    "none"
  );

  const confirmed = recordState(employee.hrCompletedAt) === "confirmed";

  return (
    <>
      <PageHeader
        icon={UsersIcon}
        title={employee.employeeName}
        badge={
          <StateBadge
            confirmed={confirmed}
            needsAttention={review.needsAttention}
          />
        }
        description={`${employee.email} · Enviado el ${
          employee.submittedAt ? dateFormat.format(employee.submittedAt) : "—"
        }`}
        actions={
          <div className="flex items-center gap-3">
            {confirmed ? (
              <RecordAction action="reopen" invitationId={invitationId} />
            ) : null}
            {confirmed || editing !== "none" ? null : (
              <>
                <Button
                  variant="outline"
                  onClick={() => setEditing("employment")}
                >
                  {employmentComplete
                    ? "Editar datos laborales"
                    : "Completar datos laborales"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setEditing("submission")}
                >
                  Editar datos
                </Button>
                <RecordAction
                  action="confirm"
                  invitationId={invitationId}
                  needsAttention={review.needsAttention}
                  employmentComplete={employmentComplete}
                />
              </>
            )}
          </div>
        }
      />

      {SECTIONS.map((section) => (
        <FieldReviewSection
          key={section}
          section={section}
          fields={review.fields}
        />
      ))}

      <Dialog
        open={editing === "submission" && !confirmed}
        onOpenChange={(open) => {
          if (!open) {
            setEditing("none");
          }
        }}
      >
        <DialogContent size="lg">
          <EmployeeEditForm
            invitationId={invitationId}
            values={values}
            fields={review.fields}
            onDone={() => setEditing("none")}
          />
        </DialogContent>
      </Dialog>

      <EmploymentSection
        values={employmentValues}
        complete={employmentComplete}
      />

      <Dialog
        open={editing === "employment" && !confirmed}
        onOpenChange={(open) => {
          if (!open) {
            setEditing("none");
          }
        }}
      >
        <DialogContent size="lg">
          <EmploymentForm
            invitationId={invitationId}
            values={employmentValues}
            imssRegistration={imssRegistration}
            onDone={() => setEditing("none")}
          />
        </DialogContent>
      </Dialog>

      <EmployeeDocuments
        invitationId={invitationId}
        documents={documents}
        extractions={extractions}
      />
    </>
  );
}
