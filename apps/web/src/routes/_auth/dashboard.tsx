import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@horkos/ui/components/card";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { HouseIcon } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { getInvitationMetrics } from "@/functions/invitations";
import { INVITATION_METRICS } from "@/lib/invitation-metrics";

export const Route = createFileRoute("/_auth/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  const { data } = useQuery({
    queryKey: ["invitations", "metrics"],
    queryFn: () => getInvitationMetrics(),
  });

  return (
    <>
      <PageHeader
        icon={HouseIcon}
        title="Inicio"
        description="El avance de las invitaciones activas, de la invitación al contrato"
      />

      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {INVITATION_METRICS.map(({ key, label }) => (
          <li key={key} className="grid">
            <Card>
              <CardHeader>
                <CardDescription>{label}</CardDescription>
                <CardTitle>
                  <p className="text-primary text-3xl font-semibold tabular-nums">
                    {data?.[key] ?? "–"}
                  </p>
                </CardTitle>
              </CardHeader>
            </Card>
          </li>
        ))}
      </ul>
    </>
  );
}
