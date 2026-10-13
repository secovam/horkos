import { z } from "zod";

import type { ExtractionResult } from "./extraction";
import { submissionSchema } from "./submission";
import type { DocumentKind } from "./submission";

// A document the server already has, as the employee's browser sees it.
export interface UploadedDocument {
  fileName: string;
  extraction: ExtractionResult;
}

export type DocumentUpload =
  | { status: "empty" }
  | { status: "uploading"; fileName: string }
  | ({ status: "uploaded" } & UploadedDocument)
  | { status: "rejected"; message: string };

export type DocumentUploads = Record<DocumentKind, DocumentUpload>;

export type UploadedDocuments = Partial<Record<DocumentKind, UploadedDocument>>;

function uploadFor(document?: UploadedDocument): DocumentUpload {
  return document ? { status: "uploaded", ...document } : { status: "empty" };
}

export function uploadsFromServer(
  documents: UploadedDocuments
): DocumentUploads {
  return {
    tax_status: uploadFor(documents.tax_status),
    imss: uploadFor(documents.imss),
    proof_of_address: uploadFor(documents.proof_of_address),
  };
}

// The data fields wait for every document, so a late prefill never lands on top of what the person typed.
export function allDocumentsRead(uploads: DocumentUploads) {
  return Object.values(uploads).every(({ status }) => status === "uploaded");
}

const documentUploadSchema = z
  .custom<DocumentUpload>()
  .superRefine((upload, context) => {
    if (upload.status === "uploaded") {
      return;
    }

    context.addIssue({
      code: "custom",
      message:
        upload.status === "uploading"
          ? "Espera a que termine de subirse este documento."
          : "Sube este documento.",
    });
  });

export const submissionFormSchema = submissionSchema.extend({
  files: z.object({
    tax_status: documentUploadSchema,
    imss: documentUploadSchema,
    proof_of_address: documentUploadSchema,
  }),
});
