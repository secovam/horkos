import { Badge } from "@horkos/ui/components/badge";
import { buttonVariants } from "@horkos/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@horkos/ui/components/card";
import { ExternalLinkIcon } from "lucide-react";

import type { getEmployee } from "@/functions/employees";
import {
  EXTRACTION_STATUS_LABELS,
  warningMessage,
} from "@/lib/employee-record";
import type { ExtractionStatus } from "@/lib/extraction";
import { DOCUMENT_KINDS, DOCUMENT_KIND_LIST } from "@/lib/submission";

type Employee = NonNullable<Awaited<ReturnType<typeof getEmployee>>>;

const STATUS_VARIANTS = {
  extracted: "secondary",
  unreadable: "destructive",
  failed: "destructive",
} as const satisfies Record<ExtractionStatus, "secondary" | "destructive">;

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
    <Card>
      <CardHeader>
        <CardTitle>Documentos</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="divide-y">
          {DOCUMENT_KIND_LIST.map((kind) => {
            const file = documents.find((item) => item.kind === kind);
            const extraction = extractions.find((item) => item.kind === kind);

            return (
              <li
                key={kind}
                className="flex flex-wrap items-start justify-between gap-3 py-3"
              >
                <div className="grid gap-1">
                  <h3 className="text-sm font-medium">
                    {DOCUMENT_KINDS[kind].label}
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
                    {extraction ? (
                      <Badge variant={STATUS_VARIANTS[extraction.status]}>
                        {EXTRACTION_STATUS_LABELS[extraction.status]}
                      </Badge>
                    ) : (
                      <Badge variant="outline">Sin lectura</Badge>
                    )}
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
      </CardContent>
    </Card>
  );
}
