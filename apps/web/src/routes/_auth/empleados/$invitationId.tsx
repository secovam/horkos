import { Badge } from "@horkos/ui/components/badge";
import { buttonVariants } from "@horkos/ui/components/button";
import { Link, createFileRoute, notFound } from "@tanstack/react-router";
import { ArrowLeftIcon, UserSearchIcon, UsersIcon } from "lucide-react";

import { EmployeeDocuments } from "@/components/employees/employee-documents";
import { FieldReviewSection } from "@/components/employees/field-review-section";
import { EmptyStateCard } from "@/components/invitations/invitations-empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { getEmployee } from "@/functions/employees";

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

function EmployeePage() {
  const { employee, review, documents, extractions } = Route.useLoaderData();
  const { invitationId } = Route.useParams();

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
            {review.needsAttention ? (
              <Badge variant="destructive">Revisar</Badge>
            ) : (
              <Badge variant="secondary">Sin diferencias</Badge>
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

      {SECTIONS.map((section) => (
        <FieldReviewSection
          key={section}
          section={section}
          fields={review.fields}
        />
      ))}

      <EmployeeDocuments
        invitationId={invitationId}
        documents={documents}
        extractions={extractions}
      />
    </>
  );
}
