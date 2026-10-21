import { Badge } from "@horkos/ui/components/badge";
import { buttonVariants } from "@horkos/ui/components/button";
import { ExternalLinkIcon } from "lucide-react";

import type { getEmployee } from "@/functions/employees";
import { warningMessage } from "@/lib/employee-record";
import type { ExtractionStatus } from "@/lib/extraction";
import {
  STORED_DOCUMENT_KINDS,
  STORED_DOCUMENT_KIND_LIST,
} from "@/lib/submission";

type Employee = NonNullable<Awaited<ReturnType<typeof getEmployee>>>;

// A document read without trouble is the normal case, so only problems get a badge.
const STATUS_BADGES = {
  extracted: null,
  unreadable: { variant: "destructive", label: "Ilegible" },
  failed: { variant: "destructive", label: "Falló la lectura" },
} as const satisfies Record<
  ExtractionStatus,
  { variant: "destructive"; label: string } | null
>;

const dateFormat = new Intl.DateTimeFormat("es-MX", { dateStyle: "medium" });

function formatSize(bytes: number) {
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function EmployeeDocuments({
  invitationId,
  documents,
  extractions,
}: {
  invitationId: string;
  documents: Employee["documents"];
  extractions: Employee["extractions"];
}) {
  return (
    <section className="grid gap-3 border-t pt-10 first-of-type:border-t-0 first-of-type:pt-0">
      <h2 className="text-primary text-lg font-semibold">Documentos</h2>
      <ul className="divide-border/50 divide-y">
        {STORED_DOCUMENT_KIND_LIST.map((kind) => {
          const file = documents.find((item) => item.kind === kind);
          const extraction = extractions.find((item) => item.kind === kind);
          const badge = extraction ? STATUS_BADGES[extraction.status] : null;

          return (
            <li
              key={kind}
              className="flex flex-wrap items-start justify-between gap-3 py-3"
            >
              <div className="grid gap-1">
                <h3 className="text-sidebar-primary text-sm font-medium">
                  {STORED_DOCUMENT_KINDS[kind].label}
                </h3>
                {file ? (
                  <p className="text-muted-foreground text-sm">
                    {file.fileName} · {formatSize(file.size)} · Subido el{" "}
                    {dateFormat.format(file.uploadedAt)}
                  </p>
                ) : (
                  <p className="text-muted-foreground text-sm">
                    No hay archivo.
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  {extraction ? null : (
                    <Badge variant="outline">Sin lectura</Badge>
                  )}
                  {badge ? (
                    <Badge variant={badge.variant}>{badge.label}</Badge>
                  ) : null}
                  {extraction?.warnings.map((warning) => (
                    <span key={warning} className="text-sm">
                      {warningMessage(warning)}
                    </span>
                  ))}
                </div>
              </div>
              {file && (
                <a
                  className={buttonVariants({
                    variant: "outline",
                    size: "sm",
                  })}
                  href={`/api/documentos/${invitationId}/${kind}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Ver documento
                  <ExternalLinkIcon data-icon="inline-end" />
                </a>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
