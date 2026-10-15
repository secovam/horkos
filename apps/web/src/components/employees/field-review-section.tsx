import { Badge } from "@horkos/ui/components/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@horkos/ui/components/card";

import { displayValue } from "@/lib/employee-record";
import type { FieldReview, FieldStatus } from "@/lib/employee-record";
import {
  DOCUMENT_KINDS,
  SUBMISSION_FIELDS,
  SUBMISSION_SECTIONS,
} from "@/lib/submission";
import type { SubmissionSection } from "@/lib/submission";

const STATUS_BADGES = {
  matches: { variant: "secondary", label: "Coincide" },
  differs: { variant: "destructive", label: "Difiere" },
  not_extracted: { variant: "outline", label: "Ningún documento lo propuso" },
} as const satisfies Record<
  FieldStatus,
  { variant: "secondary" | "destructive" | "outline"; label: string }
>;

function FieldRow({ review }: { review: FieldReview }) {
  const badge = STATUS_BADGES[review.status];

  return (
    <div className="grid gap-1 py-3 sm:grid-cols-3 sm:gap-4">
      <dt className="text-sm font-medium">
        {SUBMISSION_FIELDS[review.field].label}
      </dt>
      <dd className="sm:col-span-2">
        <p>
          <span className="text-muted-foreground text-xs">
            Enviado por el empleado:{" "}
          </span>
          <span>{displayValue(review.field, review.submitted)}</span>
        </p>
        {review.proposals.map(({ kind, value }) => (
          <p key={kind}>
            <span className="text-muted-foreground text-xs">
              {DOCUMENT_KINDS[kind].label}:{" "}
            </span>
            <span>{displayValue(review.field, value)}</span>
          </p>
        ))}
        <div className="mt-1">
          <Badge variant={badge.variant}>{badge.label}</Badge>
        </div>
      </dd>
    </div>
  );
}

export function FieldReviewSection({
  section,
  fields,
}: {
  section: SubmissionSection;
  fields: readonly FieldReview[];
}) {
  const title = SUBMISSION_SECTIONS[section];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="divide-y">
          {fields.flatMap((review) =>
            SUBMISSION_FIELDS[review.field].section === section
              ? [<FieldRow key={review.field} review={review} />]
              : []
          )}
        </dl>
      </CardContent>
    </Card>
  );
}
