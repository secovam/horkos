import { displayValue } from "@/lib/employee-record";
import type { FieldReview } from "@/lib/employee-record";
import { DOCUMENT_KINDS } from "@/lib/submission";

export function FieldProposals({ review }: { review: FieldReview }) {
  return (
    <>
      {review.proposals.map(({ kind, value }) => (
        <p key={kind}>
          <span className="text-muted-foreground text-xs">
            {DOCUMENT_KINDS[kind].label}:{" "}
          </span>
          <span>{displayValue(review.field, value)}</span>
        </p>
      ))}
    </>
  );
}
