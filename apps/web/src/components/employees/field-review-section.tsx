import { Badge } from "@horkos/ui/components/badge";

import { FieldProposals } from "@/components/employees/field-proposals";
import { displayValue } from "@/lib/employee-record";
import type { FieldReview, FieldStatus } from "@/lib/employee-record";
import { SUBMISSION_FIELDS, SUBMISSION_SECTIONS } from "@/lib/submission";
import type { SubmissionSection } from "@/lib/submission";

const STATUS_BADGES = {
  matches: { variant: "secondary", label: "Coincide" },
  differs: { variant: "destructive", label: "Difiere" },
  not_extracted: null,
} as const satisfies Record<
  FieldStatus,
  { variant: "secondary" | "destructive"; label: string } | null
>;

function FieldRow({ review }: { review: FieldReview }) {
  const badge = STATUS_BADGES[review.status];

  return (
    <div className="grid gap-1 py-3 sm:grid-cols-3 sm:gap-4">
      <dt className="text-sidebar-primary text-sm font-medium">
        {SUBMISSION_FIELDS[review.field].label}
      </dt>
      <dd className="sm:col-span-2">
        <p>
          <span className="text-muted-foreground text-xs">
            Dato registrado:{" "}
          </span>
          <span>{displayValue(review.field, review.submitted)}</span>
        </p>
        <FieldProposals review={review} />
        {badge ? (
          <div className="mt-1">
            <Badge variant={badge.variant}>{badge.label}</Badge>
          </div>
        ) : null}
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
    <section className="grid gap-3 border-t pt-10 first-of-type:border-t-0 first-of-type:pt-0">
      <h2 className="text-primary text-lg font-semibold">{title}</h2>
      <dl className="divide-border/50 divide-y">
        {fields.flatMap((review) =>
          SUBMISSION_FIELDS[review.field].section === section
            ? [<FieldRow key={review.field} review={review} />]
            : []
        )}
      </dl>
    </section>
  );
}
