import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@horkos/ui/components/alert";
import { Badge } from "@horkos/ui/components/badge";
import { Button } from "@horkos/ui/components/button";
import { Card, CardContent } from "@horkos/ui/components/card";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@horkos/ui/components/field";
import { Input } from "@horkos/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@horkos/ui/components/select";
import { useForm, useStore } from "@tanstack/react-form";
import type { AnyFieldApi } from "@tanstack/react-form";
import { BotIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ComponentProps, ReactNode } from "react";

import {
  tourAnchor,
  useSubmissionTour,
} from "@/components/submission/submission-tour";
import type { TourAnchor } from "@/components/submission/submission-tour";
import { usePostalCode } from "@/components/submission/use-postal-code";
import {
  findPostalCode,
  submitInvitation,
  uploadDocument,
} from "@/functions/employee-invitation";
import {
  allDocumentsRead,
  submissionFormSchema,
  uploadsFromServer,
} from "@/lib/document-upload";
import type {
  DocumentUpload,
  DocumentUploads,
  UploadedDocuments,
} from "@/lib/document-upload";
import type { ExtractedFields } from "@/lib/extraction";
import { matchSuburb } from "@/lib/postal-code";
import {
  DOCUMENT_ACCEPT,
  DOCUMENT_KINDS,
  DOCUMENT_KIND_LIST,
  MARITAL_STATUSES,
  MARITAL_STATUS_LIST,
  RELATIONSHIPS,
  RELATIONSHIP_LIST,
  SUBMISSION_FIELDS,
  documentFileSchema,
} from "@/lib/submission";
import type { DocumentKind, SubmissionInput } from "@/lib/submission";

type ChoiceFieldName = "maritalStatus" | "beneficiaryRelationship";

type TextFieldName = Exclude<keyof SubmissionInput, ChoiceFieldName>;

interface TextFieldConfig {
  name: TextFieldName;
  autoComplete: string;
  inputMode?: ComponentProps<"input">["inputMode"];
  autoCapitalize?: string;
  maxLength?: number;
}

interface ChoiceFieldConfig {
  name: ChoiceFieldName;
  items: readonly { value: string; label: string }[];
}

function choiceItems<T extends string>(
  values: readonly T[],
  labels: Record<T, { label: string }>
) {
  return values.map((value) => ({ value, label: labels[value].label }));
}

const PERSONAL_FIELDS: readonly TextFieldConfig[] = [
  {
    name: "fullName",
    autoComplete: "name",
  },
  {
    name: "rfc",
    autoComplete: "off",
    autoCapitalize: "characters",
    maxLength: 13,
  },
  {
    name: "curp",
    autoComplete: "off",
    autoCapitalize: "characters",
    maxLength: 18,
  },
  {
    name: "nss",
    autoComplete: "off",
    inputMode: "numeric",
    maxLength: 11,
  },
  {
    name: "phone",
    autoComplete: "tel-national",
    inputMode: "tel",
    maxLength: 14,
  },
];

const ADDRESS_FIELDS: readonly TextFieldConfig[] = [
  {
    name: "street",
    autoComplete: "address-line1",
  },
  {
    name: "extNumber",
    autoComplete: "off",
  },
  {
    name: "intNumber",
    autoComplete: "off",
  },
];

const POSTAL_CODE_FIELD = {
  name: "postalCode",
  autoComplete: "postal-code",
  inputMode: "numeric",
  maxLength: 5,
} satisfies TextFieldConfig;

const SUBURB_FIELD = {
  name: "suburb",
  autoComplete: "address-level3",
} satisfies TextFieldConfig;

const CITY_FIELD = {
  name: "city",
  autoComplete: "address-level2",
} satisfies TextFieldConfig;

const STATE_FIELD = {
  name: "state",
  autoComplete: "address-level1",
} satisfies TextFieldConfig;

const BENEFICIARY_FIELDS: readonly TextFieldConfig[] = [
  {
    name: "beneficiaryName",
    autoComplete: "off",
  },
];

const PERSONAL_CHOICES: readonly ChoiceFieldConfig[] = [
  {
    name: "maritalStatus",
    items: choiceItems(MARITAL_STATUS_LIST, MARITAL_STATUSES),
  },
];

const BENEFICIARY_CHOICES: readonly ChoiceFieldConfig[] = [
  {
    name: "beneficiaryRelationship",
    items: choiceItems(RELATIONSHIP_LIST, RELATIONSHIPS),
  },
];

const CHOICE_FIELD_NAMES = [...PERSONAL_CHOICES, ...BENEFICIARY_CHOICES].map(
  ({ name }) => name
);

const TEXT_FIELD_NAMES = [
  ...PERSONAL_FIELDS,
  ...ADDRESS_FIELDS,
  POSTAL_CODE_FIELD,
  SUBURB_FIELD,
  CITY_FIELD,
  STATE_FIELD,
  ...BENEFICIARY_FIELDS,
].map(({ name }) => name);

const TEXT_SECTIONS = [
  {
    step: 2,
    legend: "Datos personales",
    anchor: "personal",
    fields: PERSONAL_FIELDS,
    choices: PERSONAL_CHOICES,
    postal: false,
  },
  {
    step: 3,
    legend: "Domicilio",
    anchor: "address",
    fields: ADDRESS_FIELDS,
    choices: [],
    postal: true,
  },
  {
    step: 4,
    legend: "Beneficiario",
    anchor: "beneficiary",
    fields: BENEFICIARY_FIELDS,
    choices: BENEFICIARY_CHOICES,
    postal: false,
  },
] as const;

function SectionLegend({ step, children }: { step: number; children: string }) {
  return (
    <FieldLegend>
      <span className="flex items-center gap-2">
        <span className="bg-secondary text-secondary-foreground flex size-6 items-center justify-center rounded-full text-xs font-semibold tabular-nums">
          {step}
        </span>
        {children}
      </span>
    </FieldLegend>
  );
}

// A legend sits outside the fieldset's gap, so the fields need their own space below it.
function SectionFields({ children }: { children: ReactNode }) {
  return (
    <div className="pt-2">
      <FieldGroup>{children}</FieldGroup>
    </div>
  );
}

function TextInputField({
  field,
  label,
  autoComplete,
  inputMode,
  autoCapitalize,
  maxLength,
  extracted,
  onEdit,
  locked = false,
  problem,
  description,
}: Omit<TextFieldConfig, "name"> & {
  label: string;
  field: AnyFieldApi;
  extracted?: string;
  onEdit: (name: TextFieldName) => void;
  // Filled from the postal code. Its own errors stay hidden: the postal code says what to fix.
  locked?: boolean;
  problem?: string;
  description?: string;
}) {
  const errors = locked ? [] : field.state.meta.errors;
  const invalid = problem !== undefined || errors.length > 0;

  return (
    <Field data-invalid={invalid}>
      <div className="flex items-center gap-2">
        <FieldLabel htmlFor={field.name}>{label}</FieldLabel>
        {/* Only while the value is still what the document said, so a correction drops the badge. Hidden rather than unmounted: mounting inside a fieldset leaves Chromium with a stale, collapsed layout. */}
        <span
          hidden={extracted === undefined || field.state.value !== extracted}
        >
          <Badge variant="info">
            <BotIcon data-icon="inline-start" />
            Auto-extraído
          </Badge>
        </span>
      </div>
      <Input
        id={field.name}
        name={field.name}
        type="text"
        autoComplete={autoComplete}
        inputMode={inputMode}
        autoCapitalize={autoCapitalize}
        maxLength={maxLength}
        spellCheck={false}
        disabled={locked}
        aria-invalid={invalid}
        value={field.state.value}
        onBlur={field.handleBlur}
        onChange={(event) => {
          onEdit(field.name);
          field.handleChange(event.target.value);
        }}
      />
      {description ? <FieldDescription>{description}</FieldDescription> : null}
      {problem ? (
        <FieldError>{problem}</FieldError>
      ) : (
        <FieldError errors={errors} />
      )}
    </Field>
  );
}

function ChoiceField({
  field,
  label,
  items,
  onEdit,
}: Omit<ChoiceFieldConfig, "name"> & {
  label: string;
  field: AnyFieldApi;
  onEdit?: (name: TextFieldName) => void;
}) {
  const invalid = field.state.meta.errors.length > 0;

  return (
    <Field data-invalid={invalid}>
      <FieldLabel htmlFor={field.name}>{label}</FieldLabel>
      <Select
        name={field.name}
        items={items}
        value={field.state.value || null}
        onValueChange={(value) => {
          onEdit?.(field.name);
          field.handleChange(value ?? "");
        }}
      >
        <SelectTrigger
          id={field.name}
          aria-invalid={invalid}
          onBlur={field.handleBlur}
        >
          <SelectValue placeholder="Elige una opción" />
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <FieldError errors={field.state.meta.errors} />
    </Field>
  );
}

const UPLOAD_ERROR_FALLBACK =
  "No se pudo subir el documento. Inténtalo de nuevo.";

// Only the fields a document proposed, in kind order, so a later document wins a shared field (CURP).
function proposedValues(uploads: DocumentUploads) {
  const proposed: ExtractedFields = {};

  for (const kind of DOCUMENT_KIND_LIST) {
    const upload = uploads[kind];

    if (upload.status === "uploaded") {
      Object.assign(proposed, upload.extraction.fields);
    }
  }

  return proposed;
}

function describeUpload(upload: DocumentUpload) {
  switch (upload.status) {
    case "uploading": {
      return "Subiendo y leyendo tu documento…";
    }

    case "uploaded": {
      const { fields, warnings } = upload.extraction;

      const read =
        Object.keys(fields).length > 0
          ? "Llenamos tus datos con este documento. Revísalos."
          : "No pudimos leer este documento. Escribe tus datos a mano.";

      const wrongIssuer = warnings.includes("not_cfe_or_telmex")
        ? " No parece un recibo de CFE o Telmex. Sube uno de esos."
        : "";

      return `Ya subiste ${upload.fileName}. Elige otro para reemplazarlo. ${read}${wrongIssuer}`;
    }

    default: {
      return null;
    }
  }
}

function uploadBadge(upload: DocumentUpload) {
  switch (upload.status) {
    case "empty": {
      return { variant: "outline", label: "Pendiente" } as const;
    }

    case "uploading": {
      return { variant: "info", label: "Leyendo…" } as const;
    }

    case "rejected": {
      return { variant: "destructive", label: "Rechazado" } as const;
    }

    default: {
      const { fields, warnings } = upload.extraction;

      if (warnings.length > 0) {
        return { variant: "destructive", label: "Revísalo" } as const;
      }

      return Object.keys(fields).length > 0
        ? ({ variant: "default", label: "Leído" } as const)
        : ({ variant: "secondary", label: "Sin leer" } as const);
    }
  }
}

function DocumentField({
  field,
  kind,
  onPick,
}: {
  field: AnyFieldApi;
  kind: DocumentKind;
  onPick: (file: File) => void;
}) {
  const current: DocumentUpload = field.state.value;
  const rejected = current.status === "rejected";
  const invalid = rejected || field.state.meta.errors.length > 0;
  const badge = uploadBadge(current);
  const description = describeUpload(current);

  return (
    <Field data-invalid={invalid}>
      <div className="flex items-center justify-between gap-2">
        <FieldLabel htmlFor={`file-${kind}`}>
          {DOCUMENT_KINDS[kind].label}
        </FieldLabel>
        <Badge variant={badge.variant}>{badge.label}</Badge>
      </div>
      <Input
        id={`file-${kind}`}
        name={`file_${kind}`}
        type="file"
        accept={DOCUMENT_ACCEPT}
        aria-invalid={invalid}
        onBlur={field.handleBlur}
        onChange={(event) => {
          const file = event.target.files?.[0];

          if (file) {
            onPick(file);
          }
        }}
      />
      {description ? <FieldDescription>{description}</FieldDescription> : null}
      {rejected ? <FieldError>{current.message}</FieldError> : null}
      <FieldError errors={field.state.meta.errors} />
    </Field>
  );
}

const EMPTY_VALUES = {
  fullName: "",
  rfc: "",
  curp: "",
  nss: "",
  maritalStatus: "",
  phone: "",
  street: "",
  extNumber: "",
  intNumber: "",
  suburb: "",
  postalCode: "",
  city: "",
  state: "",
  beneficiaryName: "",
  beneficiaryRelationship: "",
} satisfies SubmissionInput;

function submissionBody(token: string, values: SubmissionInput) {
  const body = new FormData();
  body.set("token", token);

  for (const name of [...TEXT_FIELD_NAMES, ...CHOICE_FIELD_NAMES]) {
    body.set(name, values[name]);
  }

  return body;
}

// The data sections wait for the documents, so a late prefill never lands on what the person typed.
function DataSection({
  step,
  legend,
  anchor,
  ready,
  children,
}: {
  step: number;
  legend: string;
  anchor: TourAnchor;
  ready: boolean;
  children: ReactNode;
}) {
  return (
    <Card {...tourAnchor(anchor)}>
      <CardContent>
        <FieldSet disabled={!ready}>
          <SectionLegend step={step}>{legend}</SectionLegend>
          {ready ? null : (
            <div className="pt-2">
              <FieldDescription>
                Se habilita cuando terminemos de leer tus 3 documentos.
              </FieldDescription>
            </div>
          )}
          <SectionFields>{children}</SectionFields>
        </FieldSet>
      </CardContent>
    </Card>
  );
}

function FormHeader({ onTour }: { onTour: () => void }) {
  return (
    <header className="flex flex-col items-start gap-2">
      <div className="flex flex-col gap-2" {...tourAnchor("welcome")}>
        <h1 className="text-primary text-xl font-semibold text-balance">
          Completa tu información
        </h1>
        <p className="text-muted-foreground text-pretty">
          Sube tus documentos y revisa tus datos. Recursos Humanos los
          confirmará antes de preparar tu contrato.
        </p>
      </div>
      <Button type="button" variant="secondary" onClick={onTour}>
        ¿Cómo lleno esto?
      </Button>
    </header>
  );
}

function ExtractedAlert() {
  return (
    <Alert variant="info">
      <BotIcon />
      <AlertTitle>
        Revisa los datos marcados como{" "}
        <strong>
          <em>Auto-extraído</em>
        </strong>
      </AlertTitle>
      <AlertDescription>
        Los leímos de tus PDF y podrían estar mal. Compáralos con tus documentos
        y corrige lo que haga falta.
      </AlertDescription>
    </Alert>
  );
}

export function SubmissionForm({
  token,
  employeeName,
  initialDocuments,
  onSubmitted,
}: {
  token: string;
  employeeName: string;
  initialDocuments: UploadedDocuments;
  onSubmitted: () => void;
}) {
  const startTour = useSubmissionTour();
  const [submitError, setSubmitError] = useState<string | null>(null);
  // Fields the person typed in. Prefills fill the rest and never count as an edit.
  const edited = useRef(new Set<TextFieldName>());

  // Newest upload per document, so a slow earlier answer cannot overwrite a later pick.
  const latestUpload = useRef<Record<DocumentKind, number>>({
    tax_status: 0,
    imss: 0,
    proof_of_address: 0,
  });

  const form = useForm({
    defaultValues: {
      ...EMPTY_VALUES,
      fullName: employeeName,
      ...proposedValues(uploadsFromServer(initialDocuments)),
      files: uploadsFromServer(initialDocuments),
    },
    validators: { onSubmit: submissionFormSchema },
    onSubmitInvalid: () => {
      document
        .querySelector<HTMLElement>('main [aria-invalid="true"]')
        ?.focus();
    },
    onSubmit: async ({ value }) => {
      setSubmitError(null);

      try {
        await submitInvitation({ data: submissionBody(token, value) });
      } catch (error) {
        // Inline next to the button, where the person is looking, so the error cannot be missed.
        setSubmitError(
          error instanceof Error
            ? error.message
            : "No se pudo enviar tu información. Inténtalo de nuevo."
        );

        return;
      }

      onSubmitted();
    },
  });

  const proposed = proposedValues(
    useStore(form.store, (state) => state.values.files)
  );

  const suburb = useStore(form.store, (state) => state.values.suburb);

  const postal = usePostalCode(
    useStore(form.store, (state) => state.values.postalCode.trim()),
    (postalCode) => findPostalCode({ data: { token, postalCode } })
  );

  const { area } = postal;

  // The catalog owns state and municipality, and the suburb takes the catalog's spelling, or
  // nothing when the document's suburb is not one of this postal code's.
  useEffect(() => {
    if (!area) {
      return;
    }

    form.setFieldValue("city", area.municipality);
    form.setFieldValue("state", area.state);

    const listed = matchSuburb(area.suburbs, suburb) ?? "";

    if (listed !== suburb) {
      form.setFieldValue("suburb", listed);
    }
  }, [form, area, suburb]);

  function markEdited(name: TextFieldName) {
    edited.current.add(name);
  }

  function prefill(fields: ExtractedFields) {
    for (const name of TEXT_FIELD_NAMES) {
      const value = fields[name];

      if (value && !edited.current.has(name)) {
        form.setFieldValue(name, value);
      }
    }
  }

  function renderTextField(
    { name, ...config }: TextFieldConfig,
    locked = false
  ) {
    return (
      <form.Field key={name} name={name}>
        {(field) => (
          <TextInputField
            field={field}
            label={SUBMISSION_FIELDS[name].label}
            extracted={proposed[name]}
            onEdit={markEdited}
            locked={locked}
            {...config}
          />
        )}
      </form.Field>
    );
  }

  function renderPostalFields() {
    const { locked } = postal;

    return (
      <>
        <form.Field
          name="postalCode"
          validators={{ onSubmit: () => postal.blocker }}
        >
          {(field) => (
            <TextInputField
              field={field}
              label={SUBMISSION_FIELDS.postalCode.label}
              extracted={proposed.postalCode}
              onEdit={markEdited}
              problem={postal.problem}
              description={postal.hint}
              {...POSTAL_CODE_FIELD}
            />
          )}
        </form.Field>
        {area ? (
          <form.Field name="suburb">
            {(field) => (
              <ChoiceField
                field={field}
                label={SUBMISSION_FIELDS.suburb.label}
                items={area.suburbs.map((name) => ({
                  value: name,
                  label: name,
                }))}
                onEdit={markEdited}
              />
            )}
          </form.Field>
        ) : (
          renderTextField(SUBURB_FIELD, locked)
        )}
        {renderTextField(CITY_FIELD, locked)}
        {renderTextField(STATE_FIELD, locked)}
      </>
    );
  }

  // oxlint-disable-next-line unicorn/consistent-function-scoping -- It captures `form`; the rule misses captures used only in JSX.
  function renderChoiceField({ name, ...config }: ChoiceFieldConfig) {
    return (
      <form.Field key={name} name={name}>
        {(field) => (
          <ChoiceField
            field={field}
            label={SUBMISSION_FIELDS[name].label}
            {...config}
          />
        )}
      </form.Field>
    );
  }

  async function upload(kind: DocumentKind, file: File) {
    latestUpload.current[kind] += 1;
    const attempt = latestUpload.current[kind];
    const isStale = () => latestUpload.current[kind] !== attempt;

    const valid = documentFileSchema.safeParse(file);

    if (!valid.success) {
      form.setFieldValue(`files.${kind}`, {
        status: "rejected",
        message: valid.error.issues[0].message,
      });

      return;
    }

    form.setFieldValue(`files.${kind}`, {
      status: "uploading",
      fileName: file.name,
    });

    const body = new FormData();
    body.set("token", token);
    body.set("kind", kind);
    body.set("file", file);

    try {
      const uploaded = await uploadDocument({ data: body });

      if (isStale()) {
        return;
      }

      form.setFieldValue(`files.${kind}`, { status: "uploaded", ...uploaded });
      prefill(uploaded.extraction.fields);
    } catch (error) {
      if (isStale()) {
        return;
      }

      form.setFieldValue(`files.${kind}`, {
        status: "rejected",
        message: error instanceof Error ? error.message : UPLOAD_ERROR_FALLBACK,
      });
    }
  }

  return (
    <form
      className="flex flex-col gap-6"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        form.handleSubmit();
      }}
    >
      <FormHeader onTour={startTour} />

      <Card {...tourAnchor("documents")}>
        <CardContent>
          <FieldSet>
            <SectionLegend step={1}>Documentos</SectionLegend>
            <SectionFields>
              {DOCUMENT_KIND_LIST.map((kind) => (
                <form.Field key={kind} name={`files.${kind}`}>
                  {(field) => (
                    <DocumentField
                      field={field}
                      kind={kind}
                      onPick={(file) => upload(kind, file)}
                    />
                  )}
                </form.Field>
              ))}
            </SectionFields>
          </FieldSet>
        </CardContent>
      </Card>

      {Object.keys(proposed).length > 0 ? <ExtractedAlert /> : null}

      <form.Subscribe
        selector={(state) => allDocumentsRead(state.values.files)}
      >
        {(documentsRead) =>
          TEXT_SECTIONS.map(
            ({ fields, choices, postal: hasPostal, ...section }) => (
              <DataSection
                key={section.anchor}
                ready={documentsRead}
                {...section}
              >
                {fields.map((config) => renderTextField(config))}
                {hasPostal ? renderPostalFields() : null}
                {choices.map(renderChoiceField)}
              </DataSection>
            )
          )
        }
      </form.Subscribe>

      {submitError ? <FieldError>{submitError}</FieldError> : null}

      <form.Subscribe selector={(state) => state.isSubmitting}>
        {(isSubmitting) => (
          <Button
            type="submit"
            size="lg"
            disabled={isSubmitting}
            {...tourAnchor("submit")}
          >
            {isSubmitting ? "Enviando…" : "Enviar mi información"}
          </Button>
        )}
      </form.Subscribe>
    </form>
  );
}
